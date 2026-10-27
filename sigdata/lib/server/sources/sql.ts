import "server-only";
import { kindFromDbType, type ResultColumn } from "@/lib/domain/sources";
import { HttpError } from "../http";

/** Máximo de linhas guardadas por resultado (o que passa disso é marcado como truncado). */
export const RESULT_ROW_LIMIT = 5000;
export const QUERY_TIMEOUT_MS = 15_000;

/** Remove comentários SQL para as verificações de segurança. */
const stripComments = (sql: string) =>
  sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");

/**
 * Aceita apenas uma consulta de leitura (SELECT/WITH/VALUES/FROM).
 * É a primeira barreira; a segunda é o modo somente-leitura de cada motor e a
 * consulta ser executada como subconsulta (`SELECT * FROM (<sql>)`).
 */
export const assertReadOnlySql = (raw: string): string => {
  const sql = raw.trim().replace(/;+\s*$/, "");
  if (!sql) throw new HttpError(400, "Consulta vazia.");
  if (sql.length > 20_000) throw new HttpError(400, "Consulta muito longa.");
  const bare = stripComments(sql).trim();
  if (bare.includes(";")) throw new HttpError(400, "Envie apenas uma consulta por vez.");
  if (!/^(select|with|values|from)\b/i.test(bare)) {
    throw new HttpError(400, "Apenas consultas de leitura (SELECT) são permitidas.");
  }
  return sql;
};

/** Cita um identificador SQL (funciona em DuckDB e Postgres). */
export const quoteIdent = (name: string) => `"${name.replaceAll('"', '""')}"`;

/** Cita um nome possivelmente qualificado (`schema.tabela`). */
export const quoteQualified = (name: string) => name.split(".").map(quoteIdent).join(".");

/** Nome de tabela seguro a partir de um nome de arquivo/aba. */
export const toTableName = (raw: string, taken: Set<string>): string => {
  const base =
    raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "tabela";
  let name = /^[0-9]/.test(base) ? `t_${base}` : base;
  let n = 2;
  while (taken.has(name)) name = `${base}_${n++}`;
  taken.add(name);
  return name;
};

/** Nomes de colunas únicos (consultas podem repetir nomes, ex.: dois `count`). */
export const uniqueColumnNames = (names: string[]) => {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    return count === 0 ? name : `${name}_${count + 1}`;
  });
};

/** Converte valores para JSON estável; colunas numéricas viram number. */
export const normalizeValue = (value: unknown, column: ResultColumn): unknown => {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (column.kind === "numero" && typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  if (typeof value === "object") return JSON.parse(JSON.stringify(value)) as unknown;
  return value;
};

export const toColumns = (names: string[], dbTypes: string[]): ResultColumn[] =>
  uniqueColumnNames(names).map((name, index) => ({
    name,
    dbType: dbTypes[index] ?? "UNKNOWN",
    kind: kindFromDbType(dbTypes[index] ?? ""),
  }));

export const rowsToObjects = (columns: ResultColumn[], rows: unknown[][]) =>
  rows.map((row) =>
    Object.fromEntries(columns.map((column, i) => [column.name, normalizeValue(row[i], column)])),
  );

export type QueryOutput = {
  columns: ResultColumn[];
  rows: Record<string, unknown>[];
  truncated: boolean;
  durationMs: number;
};
