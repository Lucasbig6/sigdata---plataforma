import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import ExcelJS from "exceljs";
import { kindFromDbType, type SourceColumn, type SourceTable } from "@shared/domain/sources";
import { HttpError } from "../http";
import {
  QUERY_TIMEOUT_MS,
  RESULT_ROW_LIMIT,
  quoteIdent,
  rowsToObjects,
  toColumns,
  toTableName,
  type QueryOutput,
} from "./sql";

/**
 * Motor analítico das fontes baseadas em arquivo (CSV, XLSX, demonstração).
 * Cada fonte vira um arquivo DuckDB próprio em `storage/sources/<id>/data.duckdb`.
 */

const STORAGE_ROOT = path.resolve(process.env.SIGDATA_STORAGE_DIR ?? "storage");

export const sourceDir = (id: string) => path.join(STORAGE_ROOT, "sources", id);
const duckPath = (id: string) => path.join(sourceDir(id), "data.duckdb");

/** Caminho como literal SQL (barras normais funcionam no Windows também). */
const sqlPath = (p: string) => `'${p.replaceAll("\\", "/").replaceAll("'", "''")}'`;

const withWritable = async <T>(id: string, fn: (conn: DuckDBConnection) => Promise<T>) => {
  await mkdir(sourceDir(id), { recursive: true });
  const instance = await DuckDBInstance.create(duckPath(id));
  const conn = await instance.connect();
  try {
    return await fn(conn);
  } finally {
    conn.closeSync();
    instance.closeSync();
  }
};

const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** Esquema + perfil (nulos, distintos, min/max, média) via SUMMARIZE. */
const describeTable = async (conn: DuckDBConnection, table: string): Promise<SourceTable> => {
  const summary = await conn.runAndReadAll(`SUMMARIZE ${quoteIdent(table)}`);
  const rows = (await summary.getRowObjectsJson()) as Record<string, unknown>[];
  const countResult = await conn.runAndReadAll(`SELECT count(*) AS n FROM ${quoteIdent(table)}`);
  const rowCount = num((await countResult.getRowsJson())[0]?.[0]) ?? 0;

  const columns: SourceColumn[] = rows.map((row) => {
    const dbType = String(row.column_type ?? "");
    const kind = kindFromDbType(dbType);
    const nulosPct = num(row.null_percentage) ?? 0;
    return {
      name: String(row.column_name),
      dbType,
      kind,
      profile: {
        nulosPct: Math.round(nulosPct * 100) / 100,
        nulos: Math.round((rowCount * nulosPct) / 100),
        distintos: num(row.approx_unique),
        min: row.min == null ? null : String(row.min),
        max: row.max == null ? null : String(row.max),
        media: kind === "numero" ? num(row.avg) : null,
      },
    };
  });
  return { name: table, rowCount, columns };
};

/** Número no formato brasileiro: milhar com ponto opcional e decimal com vírgula. */
const BR_NUMBER = String.raw`^-?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$`;

/**
 * CSVs brasileiros costumam usar vírgula decimal ("35000,50"), que o detector
 * lê como texto. Converte para DOUBLE colunas de texto em que todos os valores
 * seguem esse formato e ao menos um tem vírgula.
 */
const fixBrazilianNumbers = async (conn: DuckDBConnection, table: string) => {
  const info = await conn.runAndReadAll(`DESCRIBE ${quoteIdent(table)}`);
  const textColumns = ((await info.getRowObjectsJson()) as { column_name: string; column_type: string }[])
    .filter((row) => row.column_type === "VARCHAR")
    .map((row) => row.column_name);
  for (const column of textColumns) {
    const col = quoteIdent(column);
    const check = await conn.runAndReadAll(
      `SELECT count(${col}) AS n,
              count(*) FILTER (WHERE ${col} IS NOT NULL AND NOT regexp_full_match(trim(${col}), '${BR_NUMBER}')) AS invalidos,
              count(*) FILTER (WHERE ${col} LIKE '%,%') AS com_virgula
         FROM ${quoteIdent(table)}`,
    );
    const [n, invalid, withComma] = ((await check.getRowsJson())[0] ?? []).map(Number);
    if (n > 0 && invalid === 0 && withComma > 0) {
      await conn.run(
        `ALTER TABLE ${quoteIdent(table)} ALTER ${col} TYPE DOUBLE ` +
          `USING replace(replace(trim(${col}), '.', ''), ',', '.')::DOUBLE`,
      );
    }
  }
};

const loadCsv = async (conn: DuckDBConnection, table: string, file: string) => {
  await conn.run(
    `CREATE OR REPLACE TABLE ${quoteIdent(table)} AS ` +
      `SELECT * FROM read_csv(${sqlPath(file)}, auto_detect = true, sample_size = 20000, normalize_names = true)`,
  );
  await fixBrazilianNumbers(conn, table);
};

export const ingestCsv = async (id: string, file: string, fileName: string) =>
  withWritable(id, async (conn) => {
    const table = toTableName(fileName, new Set());
    try {
      await loadCsv(conn, table, file);
    } catch (error) {
      throw new HttpError(422, `Não foi possível ler o CSV: ${(error as Error).message}`);
    }
    return [await describeTable(conn, table)];
  });

const cellText = (value: ExcelJS.CellValue): string => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("result" in value && value.result !== undefined) return cellText(value.result as ExcelJS.CellValue);
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("hyperlink" in value) return String(value.hyperlink);
    return "";
  }
  return String(value);
};

const csvCell = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);

/** XLSX: cada aba com conteúdo vira uma tabela (convertida para CSV e lida pelo DuckDB). */
export const ingestXlsx = async (id: string, file: string) => {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(file);
  } catch (error) {
    throw new HttpError(422, `Não foi possível ler a planilha: ${(error as Error).message}`);
  }
  const taken = new Set<string>();
  const sheets: { table: string; csv: string }[] = [];
  for (const sheet of workbook.worksheets) {
    const lines: string[] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = Array.from({ length: sheet.columnCount }, (_, i) =>
        csvCell(cellText(row.getCell(i + 1).value)),
      );
      lines.push(values.join(","));
    });
    if (lines.length < 2) continue;
    const csv = path.join(sourceDir(id), `${sheets.length}.csv`);
    await mkdir(sourceDir(id), { recursive: true });
    await writeFile(csv, lines.join("\n"), "utf8");
    sheets.push({ table: toTableName(sheet.name, taken), csv });
  }
  if (sheets.length === 0) throw new HttpError(422, "A planilha não tem abas com dados.");

  return withWritable(id, async (conn) => {
    const tables: SourceTable[] = [];
    for (const sheet of sheets) {
      await loadCsv(conn, sheet.table, sheet.csv);
      tables.push(await describeTable(conn, sheet.table));
      await rm(sheet.csv, { force: true });
    }
    return tables;
  });
};

/** Grava tabelas a partir de linhas em memória (usado pela fonte de demonstração). */
export const ingestRows = async (
  id: string,
  tables: { name: string; rows: Record<string, string | number>[] }[],
) => {
  await mkdir(sourceDir(id), { recursive: true });
  const files: { table: string; csv: string }[] = [];
  for (const [index, table] of tables.entries()) {
    const header = Object.keys(table.rows[0] ?? {});
    const lines = [header.join(","), ...table.rows.map((row) => header.map((key) => csvCell(String(row[key] ?? ""))).join(","))];
    const csv = path.join(sourceDir(id), `seed-${index}.csv`);
    await writeFile(csv, lines.join("\n"), "utf8");
    files.push({ table: table.name, csv });
  }
  return withWritable(id, async (conn) => {
    const out: SourceTable[] = [];
    for (const file of files) {
      await loadCsv(conn, file.table, file.csv);
      out.push(await describeTable(conn, file.table));
      await rm(file.csv, { force: true });
    }
    return out;
  });
};

/* ---------------------------------------------------------------- leitura */

const readers = new Map<string, Promise<DuckDBInstance>>();

/**
 * Instância somente-leitura e isolada: sem acesso a arquivos externos, sem
 * extensões e com configuração travada — a SQL vinda da IA não consegue ler o
 * disco do servidor nem reabrir essas opções.
 */
const reader = (id: string) => {
  let instance = readers.get(id);
  if (!instance) {
    instance = DuckDBInstance.create(duckPath(id), {
      access_mode: "READ_ONLY",
      enable_external_access: "false",
      autoinstall_known_extensions: "false",
      autoload_known_extensions: "false",
      allow_community_extensions: "false",
      threads: "2",
      memory_limit: "512MB",
      lock_configuration: "true",
    });
    instance.catch(() => readers.delete(id));
    readers.set(id, instance);
  }
  return instance;
};

/** Fecha a instância em cache (necessário antes de apagar o arquivo no Windows). */
export const releaseDuck = async (id: string) => {
  const instance = readers.get(id);
  readers.delete(id);
  if (instance) (await instance.catch(() => null))?.closeSync();
};

export const removeDuckFiles = async (id: string) => {
  await releaseDuck(id);
  await rm(sourceDir(id), { recursive: true, force: true });
};

export const queryDuck = async (id: string, sql: string, limit = RESULT_ROW_LIMIT): Promise<QueryOutput> => {
  const conn = await (await reader(id)).connect();
  const started = Date.now();
  const timer = setTimeout(() => conn.interrupt(), QUERY_TIMEOUT_MS);
  try {
    const result = await conn.runAndReadAll(`SELECT * FROM (${sql}) AS sigdata_q LIMIT ${limit + 1}`);
    const columns = toColumns(result.columnNames(), result.columnTypes().map(String));
    const raw = (await result.getRowsJson()) as unknown[][];
    return {
      columns,
      rows: rowsToObjects(columns, raw.slice(0, limit)),
      truncated: raw.length > limit,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    const message = (error as Error).message ?? String(error);
    if (/interrupt/i.test(message)) {
      throw new HttpError(408, `A consulta passou de ${QUERY_TIMEOUT_MS / 1000}s e foi cancelada.`);
    }
    throw new HttpError(400, `Erro na consulta: ${message.split("\n")[0]}`);
  } finally {
    clearTimeout(timer);
    conn.closeSync();
  }
};
