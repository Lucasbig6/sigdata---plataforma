import mysql from "mysql2/promise";
import {
  kindFromDbType,
  type ColumnProfile,
  type SourceTable,
  type SqlConnectionInput,
} from "@shared/domain/sources";
import { HttpError } from "../http";
import { resolveSafeHost } from "../net-guard";
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
 * Conexões com MySQL/MariaDB externos. Toda consulta roda numa transação READ ONLY com limite
 * de tempo e é sempre desfeita (ROLLBACK). `ANSI_QUOTES` faz o `"identificador"` do resto do
 * sistema valer aqui também.
 */

const MAX_TABLES = 200;

// código do protocolo → nome do tipo (para classificar as colunas de um resultado)
const FIELD_TYPES: Record<number, string> = {
  0: "decimal", 1: "tinyint", 2: "smallint", 3: "int", 4: "float", 5: "double", 7: "timestamp",
  8: "bigint", 9: "mediumint", 10: "date", 11: "time", 12: "datetime", 13: "year", 14: "date",
  16: "bit", 245: "json", 246: "decimal", 247: "enum", 248: "set", 249: "text", 250: "text",
  251: "text", 252: "text", 253: "varchar", 254: "char",
};

const connect = async (cfg: SqlConnectionInput) => {
  const address = await resolveSafeHost(cfg.host);
  try {
    const conn = await mysql.createConnection({
      host: address,
      port: cfg.port,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
      // conecta no IP validado; o nome original vale para o SNI e a conferência do certificado
      ssl: cfg.ssl ? ({ rejectUnauthorized: cfg.sslVerify !== false, servername: cfg.host } as mysql.SslOptions) : undefined,
      connectTimeout: 8000,
      rowsAsArray: true,
      dateStrings: true,
      supportBigNumbers: true,
      bigNumberStrings: false,
      multipleStatements: false,
    });
    await conn.query("SET SESSION sql_mode = CONCAT(@@sql_mode, ',ANSI_QUOTES')");
    // MySQL conta em milissegundos; MariaDB, em segundos (a variável que não existe é ignorada)
    await conn.query(`SET SESSION max_execution_time = ${QUERY_TIMEOUT_MS}`).catch(() => undefined);
    await conn.query(`SET SESSION max_statement_time = ${QUERY_TIMEOUT_MS / 1000}`).catch(() => undefined);
    return conn;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(422, `Não foi possível conectar: ${(error as Error).message}`);
  }
};

const readOnly = async <T>(cfg: SqlConnectionInput, fn: (conn: mysql.Connection) => Promise<T>) => {
  const conn = await connect(cfg);
  try {
    await conn.query("START TRANSACTION READ ONLY");
    return await fn(conn);
  } finally {
    await conn.query("ROLLBACK").catch(() => undefined);
    await conn.end().catch(() => undefined);
  }
};

/** Lista tabelas/views e colunas (sem perfil — calculado sob demanda). */
export const introspectMysql = async (cfg: SqlConnectionInput): Promise<SourceTable[]> =>
  readOnly(cfg, async (conn) => {
    const schemas = cfg.schemas?.filter(Boolean) ?? [];
    const wanted = schemas.length > 0 ? schemas : [cfg.database];
    const [rows] = await conn.query({
      sql: `SELECT c.table_schema, c.table_name, c.column_name, c.data_type, t.table_rows
              FROM information_schema.columns c
              JOIN information_schema.tables t
                ON t.table_schema = c.table_schema AND t.table_name = c.table_name
             WHERE c.table_schema IN (?)
             ORDER BY c.table_schema, c.table_name, c.ordinal_position`,
      values: [wanted],
    });
    const byTable = new Map<string, SourceTable>();
    for (const [schema, tableName, column, dataType, estimate] of rows as [string, string, string, string, string | null][]) {
      const name = wanted.length === 1 && schema === cfg.database ? tableName : `${schema}.${tableName}`;
      let table = byTable.get(name);
      if (!table) {
        if (byTable.size >= MAX_TABLES) continue;
        table = { name, rowCount: estimate == null ? null : Number(estimate), columns: [] };
        byTable.set(name, table);
      }
      table.columns.push({ name: column, dbType: dataType, kind: kindFromDbType(dataType) });
    }
    return [...byTable.values()];
  });

export const queryMysql = async (
  cfg: SqlConnectionInput,
  sql: string,
  limit = RESULT_ROW_LIMIT,
  offset = 0,
): Promise<QueryOutput> =>
  readOnly(cfg, async (conn) => {
    const started = Date.now();
    try {
      const [rows, fields] = await conn.query({
        sql: `SELECT * FROM (${sql}\n) AS sigdata_q LIMIT ${limit + 1} OFFSET ${offset}`,
        rowsAsArray: true,
      });
      const defs = fields as unknown as { name: string; columnType?: number }[];
      const columns = toColumns(
        defs.map((field) => field.name),
        defs.map((field) => FIELD_TYPES[field.columnType ?? -1] ?? "unknown"),
      );
      const all = rows as unknown[][];
      return {
        columns,
        rows: rowsToObjects(columns, all.slice(0, limit)),
        truncated: all.length > limit,
        durationMs: Date.now() - started,
      };
    } catch (error) {
      const message = (error as Error).message;
      if (/maximum statement execution time|max_statement_time|query execution was interrupted/i.test(message)) {
        throw new HttpError(408, `A consulta passou de ${QUERY_TIMEOUT_MS / 1000}s e foi cancelada.`);
      }
      throw new HttpError(400, `Erro na consulta: ${message}`);
    }
  });

/** Perfil das colunas de uma tabela (nulos, distintos, min/max, média) numa única consulta. */
export const profileMysqlTable = async (cfg: SqlConnectionInput, table: SourceTable): Promise<SourceTable> =>
  readOnly(cfg, async (conn) => {
    const parts = ["count(*) AS total"];
    table.columns.forEach((column, i) => {
      const col = quoteIdent(column.name);
      parts.push(`count(${col}) AS c${i}`, `count(DISTINCT ${col}) AS d${i}`);
      if (column.kind === "numero" || column.kind === "data") {
        parts.push(`CAST(min(${col}) AS CHAR) AS mn${i}`, `CAST(max(${col}) AS CHAR) AS mx${i}`);
      }
      if (column.kind === "numero") parts.push(`avg(${col}) AS av${i}`);
    });
    const [rows, fields] = await conn.query({
      sql: `SELECT ${parts.join(", ")} FROM ${quoteQualified(table.name)}`,
      rowsAsArray: true,
    });
    const names = (fields as unknown as { name: string }[]).map((field) => field.name);
    const row = Object.fromEntries(names.map((name, i) => [name, (rows as unknown[][])[0]?.[i]])) as Record<string, unknown>;
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
          min: (row[`mn${i}`] as string | null | undefined) ?? null,
          max: (row[`mx${i}`] as string | null | undefined) ?? null,
          media: row[`av${i}`] == null ? null : Number(row[`av${i}`]),
        };
        return { ...column, profile };
      }),
    };
  });
