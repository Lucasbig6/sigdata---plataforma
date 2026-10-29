import { Client, types, type FieldDef } from "pg";
import {
  kindFromDbType,
  type ColumnProfile,
  type PostgresConnectionInput,
  type SourceTable,
} from "@shared/domain/sources";
import { HttpError } from "../http";
import {
  QUERY_TIMEOUT_MS,
  RESULT_ROW_LIMIT,
  quoteIdent,
  quoteQualified,
  rowsToObjects,
  toColumns,
  type QueryOutput,
} from "./sql";

/**
 * Conexões com bancos Postgres externos. Toda consulta roda numa transação
 * READ ONLY com statement_timeout e é sempre desfeita (ROLLBACK).
 */

const MAX_TABLES = 200;

// date e timestamp sem fuso voltam como texto: virar Date aplicaria o fuso do servidor.
const RAW_TEXT_TYPES = new Set([1082, 1114]);
const typeParsers = {
  getTypeParser: ((oid: number, format?: "text" | "binary") =>
    RAW_TEXT_TYPES.has(oid)
      ? (value: string) => value
      : types.getTypeParser(oid, format)) as typeof types.getTypeParser,
};

const connect = async (cfg: PostgresConnectionInput) => {
  const client = new Client({
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 8000,
    statement_timeout: QUERY_TIMEOUT_MS,
    application_name: "sigdata",
    types: typeParsers,
  });
  try {
    await client.connect();
  } catch (error) {
    throw new HttpError(422, `Não foi possível conectar: ${(error as Error).message}`);
  }
  return client;
};

const readOnly = async <T>(cfg: PostgresConnectionInput, fn: (client: Client) => Promise<T>) => {
  const client = await connect(cfg);
  try {
    await client.query("BEGIN READ ONLY");
    await client.query(`SET LOCAL statement_timeout = ${QUERY_TIMEOUT_MS}`);
    return await fn(client);
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    await client.end().catch(() => undefined);
  }
};

/** Mapa OID → nome do tipo, para descrever colunas de resultados. */
const typeNames = async (client: Client, fields: FieldDef[]) => {
  const oids = [...new Set(fields.map((field) => field.dataTypeID))];
  if (oids.length === 0) return new Map<number, string>();
  const res = await client.query<{ oid: number; typname: string }>(
    "SELECT oid::int, typname FROM pg_type WHERE oid = ANY($1::oid[])",
    [oids],
  );
  return new Map(res.rows.map((row) => [row.oid, row.typname]));
};

/** Lista tabelas/views e colunas (sem perfil — calculado sob demanda). */
export const introspectPg = async (cfg: PostgresConnectionInput): Promise<SourceTable[]> =>
  readOnly(cfg, async (client) => {
    const schemas = cfg.schemas?.filter(Boolean) ?? [];
    const res = await client.query<{
      table_schema: string;
      table_name: string;
      column_name: string;
      data_type: string;
      estimate: string | null;
    }>(
      `SELECT c.table_schema, c.table_name, c.column_name, c.data_type,
              (SELECT reltuples::bigint FROM pg_class pc
                 JOIN pg_namespace n ON n.oid = pc.relnamespace
                WHERE n.nspname = c.table_schema AND pc.relname = c.table_name) AS estimate
         FROM information_schema.columns c
         JOIN information_schema.tables t
           ON t.table_schema = c.table_schema AND t.table_name = c.table_name
        WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
          AND c.table_schema NOT LIKE 'pg_toast%'
          AND ($1::text[] IS NULL OR c.table_schema = ANY($1::text[]))
        ORDER BY c.table_schema, c.table_name, c.ordinal_position`,
      [schemas.length > 0 ? schemas : null],
    );
    const byTable = new Map<string, SourceTable>();
    for (const row of res.rows) {
      const name = row.table_schema === "public" ? row.table_name : `${row.table_schema}.${row.table_name}`;
      let table = byTable.get(name);
      if (!table) {
        if (byTable.size >= MAX_TABLES) continue;
        const estimate = row.estimate == null ? null : Number(row.estimate);
        table = { name, rowCount: estimate != null && estimate >= 0 ? estimate : null, columns: [] };
        byTable.set(name, table);
      }
      table.columns.push({ name: row.column_name, dbType: row.data_type, kind: kindFromDbType(row.data_type) });
    }
    return [...byTable.values()];
  });

export const queryPg = async (
  cfg: PostgresConnectionInput,
  sql: string,
  limit = RESULT_ROW_LIMIT,
  offset = 0,
): Promise<QueryOutput> =>
  readOnly(cfg, async (client) => {
    const started = Date.now();
    try {
      const res = await client.query({
        text: `SELECT * FROM (${sql}) AS sigdata_q LIMIT ${limit + 1} OFFSET ${offset}`,
        rowMode: "array",
      });
      const names = await typeNames(client, res.fields);
      const columns = toColumns(
        res.fields.map((field) => field.name),
        res.fields.map((field) => names.get(field.dataTypeID) ?? "unknown"),
      );
      const rows = res.rows as unknown[][];
      return {
        columns,
        rows: rowsToObjects(columns, rows.slice(0, limit)),
        truncated: rows.length > limit,
        durationMs: Date.now() - started,
      };
    } catch (error) {
      const message = (error as Error).message;
      if (/statement timeout/i.test(message)) {
        throw new HttpError(408, `A consulta passou de ${QUERY_TIMEOUT_MS / 1000}s e foi cancelada.`);
      }
      throw new HttpError(400, `Erro na consulta: ${message}`);
    }
  });

/** Perfil das colunas de uma tabela (nulos, distintos, min/max, média) numa única consulta. */
export const profilePgTable = async (
  cfg: PostgresConnectionInput,
  table: SourceTable,
): Promise<SourceTable> =>
  readOnly(cfg, async (client) => {
    const parts = ["count(*) AS total"];
    table.columns.forEach((column, i) => {
      const col = quoteIdent(column.name);
      parts.push(`count(${col}) AS c${i}`, `count(DISTINCT ${col}) AS d${i}`);
      if (column.kind === "numero" || column.kind === "data") {
        parts.push(`min(${col})::text AS mn${i}`, `max(${col})::text AS mx${i}`);
      }
      if (column.kind === "numero") parts.push(`avg(${col})::float8 AS av${i}`);
    });
    const res = await client.query(`SELECT ${parts.join(", ")} FROM ${quoteQualified(table.name)}`);
    const row = res.rows[0] as Record<string, unknown>;
    const total = Number(row.total ?? 0);
    return {
      ...table,
      rowCount: total,
      columns: table.columns.map((column, i) => {
        const nonNull = Number(row[`c${i}`] ?? 0);
        const nulos = total - nonNull;
        const profile: ColumnProfile = {
          nulos,
          nulosPct: total > 0 ? Math.round((nulos / total) * 10000) / 100 : 0,
          distintos: row[`d${i}`] == null ? null : Number(row[`d${i}`]),
          min: (row[`mn${i}`] as string | undefined) ?? null,
          max: (row[`mx${i}`] as string | undefined) ?? null,
          media: row[`av${i}`] == null ? null : Number(row[`av${i}`]),
        };
        return { ...column, profile };
      }),
    };
  });
