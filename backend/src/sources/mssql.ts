import sql from "mssql";
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
 * Conexões com SQL Server externos. O SQL Server não tem transação somente-leitura, então a
 * barreira é: só SELECT/WITH (assertReadOnlySql), recusa de SELECT … INTO e chamadas de
 * procedimento (abaixo) e — o principal — um usuário só de leitura no banco. A consulta roda
 * direta (sem subconsulta, que o T-SQL não aceita com CTE ou ORDER BY) e a leitura para
 * assim que há linhas suficientes para a página.
 */

const MAX_TABLES = 200;

const FORBIDDEN = /\b(into|exec|execute|openrowset|opendatasource|openquery|bulk|waitfor|xp_\w+|sp_\w+)\b/i;

/** Texto sem literais e comentários, para checar palavras proibidas sem falso positivo em valores. */
const bare = (query: string) =>
  query
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""')
    .replace(/\[[^\]]*\]/g, "[]");

export const assertSelectOnly = (query: string) => {
  const hit = FORBIDDEN.exec(bare(query));
  if (hit) throw new HttpError(400, `"${hit[1]!.toUpperCase()}" não é permitido: apenas consultas de leitura.`);
};

const connect = async (cfg: SqlConnectionInput) => {
  const address = await resolveSafeHost(cfg.host);
  const pool = new sql.ConnectionPool({
    server: address,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    connectionTimeout: 8000,
    requestTimeout: QUERY_TIMEOUT_MS,
    options: {
      encrypt: cfg.ssl,
      trustServerCertificate: cfg.sslVerify === false || !cfg.ssl,
      serverName: cfg.host,
      appName: "sigdata",
      readOnlyIntent: true,
    },
    pool: { max: 1 },
  });
  try {
    await pool.connect();
  } catch (error) {
    throw new HttpError(422, `Não foi possível conectar: ${(error as Error).message}`);
  }
  return pool;
};

const withPool = async <T>(cfg: SqlConnectionInput, fn: (pool: sql.ConnectionPool) => Promise<T>) => {
  const pool = await connect(cfg);
  try {
    return await fn(pool);
  } finally {
    await pool.close().catch(() => undefined);
  }
};

// bit é o booleano do SQL Server; o resto do sistema reconhece "boolean"
const typeName = (declaration: string) =>
  declaration === "bit" ? "boolean" : declaration === "uniqueidentifier" ? "uuid" : declaration;

/** Lista tabelas/views e colunas (sem perfil — calculado sob demanda). */
export const introspectMssql = async (cfg: SqlConnectionInput): Promise<SourceTable[]> =>
  withPool(cfg, async (pool) => {
    const schemas = cfg.schemas?.filter(Boolean) ?? [];
    const request = pool.request().input("filter", sql.Int, schemas.length);
    schemas.forEach((schema, i) => request.input(`s${i}`, sql.NVarChar, schema));
    const result = await request.query<{
      table_schema: string;
      table_name: string;
      column_name: string;
      data_type: string;
      estimate: number | null;
    }>(
      `SELECT c.TABLE_SCHEMA AS table_schema, c.TABLE_NAME AS table_name, c.COLUMN_NAME AS column_name,
              c.DATA_TYPE AS data_type,
              (SELECT SUM(p.row_count) FROM sys.dm_db_partition_stats p
                WHERE p.object_id = OBJECT_ID(QUOTENAME(c.TABLE_SCHEMA) + '.' + QUOTENAME(c.TABLE_NAME))
                  AND p.index_id IN (0, 1)) AS estimate
         FROM INFORMATION_SCHEMA.COLUMNS c
         JOIN INFORMATION_SCHEMA.TABLES t
           ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
        WHERE c.TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA')
          ${schemas.length > 0 ? `AND c.TABLE_SCHEMA IN (${schemas.map((_, i) => `@s${i}`).join(", ")})` : ""}
        ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION`,
    );
    const byTable = new Map<string, SourceTable>();
    for (const row of result.recordset) {
      const name = row.table_schema === "dbo" ? row.table_name : `${row.table_schema}.${row.table_name}`;
      let table = byTable.get(name);
      if (!table) {
        if (byTable.size >= MAX_TABLES) continue;
        table = { name, rowCount: row.estimate == null ? null : Number(row.estimate), columns: [] };
        byTable.set(name, table);
      }
      const dbType = typeName(row.data_type);
      table.columns.push({ name: row.column_name, dbType, kind: kindFromDbType(dbType) });
    }
    return [...byTable.values()];
  });

type Streamed = { names: string[]; types: string[]; rows: unknown[][]; reached: boolean };

/** Executa a consulta lendo em fluxo; para (cancela) ao juntar `want` linhas. */
const stream = (pool: sql.ConnectionPool, query: string, want: number) =>
  new Promise<Streamed>((resolve, reject) => {
    const request = pool.request();
    request.stream = true;
    request.arrayRowMode = true;
    const out: Streamed = { names: [], types: [], rows: [], reached: false };
    let settled = false;
    const done = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(out);
    };
    request.on("recordset", (columns: Record<string, { index: number; type?: { declaration?: string } }> | sql.IColumn[]) => {
      const list = Array.isArray(columns)
        ? columns.map((column, i) => ({ name: column.name, index: i, declaration: (column as { type?: { declaration?: string } }).type?.declaration }))
        : Object.entries(columns).map(([name, column]) => ({ name, index: column.index, declaration: column.type?.declaration }));
      list.sort((a, b) => a.index - b.index);
      out.names = list.map((column) => column.name);
      out.types = list.map((column) => typeName(column.declaration ?? "unknown"));
    });
    request.on("row", (row: unknown[]) => {
      if (settled) return;
      out.rows.push(row);
      if (out.rows.length >= want) {
        out.reached = true;
        request.cancel();
        done();
      }
    });
    request.on("error", (error: Error & { code?: string }) => {
      if (out.reached) return done();
      done(error);
    });
    request.on("done", () => done());
    request.query(query);
  });

export const queryMssql = async (
  cfg: SqlConnectionInput,
  query: string,
  limit = RESULT_ROW_LIMIT,
  offset = 0,
): Promise<QueryOutput> => {
  // a contagem do editor embrulha a consulta; o resto já foi validado em assertReadOnlySql
  assertSelectOnly(query);
  return withPool(cfg, async (pool) => {
    const started = Date.now();
    try {
      const got = await stream(pool, query, offset + limit + 1);
      const columns = toColumns(got.names, got.types);
      const page = got.rows.slice(offset, offset + limit).map((row) =>
        row.map((value, i) =>
          value instanceof Date && got.types[i] === "date" ? value.toISOString().slice(0, 10) : value,
        ),
      );
      return {
        columns,
        rows: rowsToObjects(columns, page),
        truncated: got.rows.length > offset + limit,
        durationMs: Date.now() - started,
      };
    } catch (error) {
      const message = (error as Error).message;
      if (/timeout/i.test(message)) {
        throw new HttpError(408, `A consulta passou de ${QUERY_TIMEOUT_MS / 1000}s e foi cancelada.`);
      }
      throw new HttpError(400, `Erro na consulta: ${message}`);
    }
  });
};

/** Perfil das colunas de uma tabela (nulos, distintos, min/max, média) numa única consulta. */
export const profileMssqlTable = async (cfg: SqlConnectionInput, table: SourceTable): Promise<SourceTable> =>
  withPool(cfg, async (pool) => {
    const parts = ["count_big(*) AS total"];
    table.columns.forEach((column, i) => {
      const col = quoteIdent(column.name);
      parts.push(`count_big(${col}) AS c${i}`);
      if (column.kind !== "outro") parts.push(`count_big(DISTINCT ${col}) AS d${i}`);
      if (column.kind === "numero" || column.kind === "data") {
        parts.push(`CAST(min(${col}) AS nvarchar(100)) AS mn${i}`, `CAST(max(${col}) AS nvarchar(100)) AS mx${i}`);
      }
      if (column.kind === "numero") parts.push(`avg(CAST(${col} AS float)) AS av${i}`);
    });
    const result = await pool.request().query(`SELECT ${parts.join(", ")} FROM ${quoteQualified(table.name)}`);
    const row = result.recordset[0] as Record<string, unknown>;
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
