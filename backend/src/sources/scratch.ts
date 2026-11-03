import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import type { ColumnKind, ResultColumn, SourceTable } from "@shared/domain/sources";
import { runOnConnection } from "./duck";
import { quoteIdent, type QueryOutput } from "./sql";

/**
 * Área de trabalho em memória para combinar consultas de fontes diferentes.
 * Recebe uma cópia das linhas (lidas das origens em modo somente leitura) e executa
 * a junção aqui: nada é gravado nas fontes originais e nada é gravado em disco.
 */
export type Scratch = {
  /**
   * Cria uma tabela com as linhas e devolve o esquema para o compilador.
   * Com `schema`, a tabela vai para esse esquema (`schema.tabela` no SQL).
   */
  load: (name: string, columns: ResultColumn[], rows: Record<string, unknown>[], schema?: string) => Promise<SourceTable>;
  execute: (sql: string, limit?: number, offset?: number) => Promise<QueryOutput>;
  close: () => void;
};

const DUCK_TYPES: Record<ColumnKind, string> = {
  numero: "DOUBLE",
  texto: "VARCHAR",
  booleano: "BOOLEAN",
  data: "VARCHAR", // convertido para DATE/TIMESTAMP depois da carga
  outro: "VARCHAR",
};

const BATCH = 400;

const literal = (value: unknown): string => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `'${text.replaceAll("\0", "").replaceAll("'", "''")}'`;
};

export const openScratch = async (): Promise<Scratch> => {
  const instance = await DuckDBInstance.create(":memory:", {
    enable_external_access: "false",
    autoinstall_known_extensions: "false",
    autoload_known_extensions: "false",
    allow_community_extensions: "false",
    threads: "2",
    memory_limit: "768MB",
  });
  const conn: DuckDBConnection = await instance.connect();

  return {
    load: async (name, columns, rows, schema) => {
      if (schema) await conn.run(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schema)}`);
      const target = schema ? `${quoteIdent(schema)}.${quoteIdent(name)}` : quoteIdent(name);
      const defs = columns.map((column) => `${quoteIdent(column.name)} ${DUCK_TYPES[column.kind]}`).join(", ");
      await conn.run(`CREATE TABLE ${target} (${defs})`);
      for (let start = 0; start < rows.length; start += BATCH) {
        const values = rows
          .slice(start, start + BATCH)
          .map((row) => `(${columns.map((column) => literal(row[column.name])).join(", ")})`)
          .join(", ");
        await conn.run(`INSERT INTO ${target} VALUES ${values}`);
      }
      const loaded: SourceTable["columns"] = [];
      for (const column of columns) {
        let dbType = DUCK_TYPES[column.kind];
        if (column.kind === "data") {
          dbType = /timestamp|datetime/i.test(column.dbType) ? "TIMESTAMP" : "DATE";
          const ref = quoteIdent(column.name);
          await conn.run(`ALTER TABLE ${target} ALTER ${ref} TYPE ${dbType} USING TRY_CAST(${ref} AS ${dbType})`);
        }
        loaded.push({ name: column.name, dbType, kind: column.kind });
      }
      return { name, rowCount: rows.length, columns: loaded };
    },
    execute: (sql, limit, offset) => runOnConnection(conn, sql, limit, offset),
    close: () => {
      conn.closeSync();
      instance.closeSync();
    },
  };
};
