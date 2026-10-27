import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, desc, eq } from "drizzle-orm";
import type {
  AnalyticResult,
  DataSource,
  PostgresConnectionInput,
  SourceTable,
  TablePreview,
} from "@shared/domain/sources";
import { MUNICIPIOS, SERIE_TEMPORAL } from "@shared/demo-data";
import { decryptJson, encryptJson } from "../crypto";
import { db, schema } from "../db";
import { HttpError, notFound } from "../http";
import { ingestCsv, ingestRows, ingestXlsx, queryDuck, removeDuckFiles, sourceDir } from "./duck";
import { introspectPg, profilePgTable, queryPg } from "./pg";
import { assertReadOnlySql, quoteQualified } from "./sql";

type SourceRow = typeof schema.dataSources.$inferSelect;

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const PREVIEW_ROWS = 50;

const connectionOf = (row: SourceRow) => {
  if (row.kind !== "postgresql" || !row.connection) {
    throw new HttpError(400, "Fonte sem conexão configurada.");
  }
  return decryptJson<PostgresConnectionInput>(row.connection);
};

export const toDataSource = (row: SourceRow): DataSource => {
  let connectionLabel: string | null = null;
  if (row.kind === "postgresql" && row.connection) {
    try {
      const cfg = decryptJson<PostgresConnectionInput>(row.connection);
      connectionLabel = `${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`;
    } catch {
      connectionLabel = "credencial ilegível";
    }
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    kind: row.kind,
    status: row.status,
    error: row.error,
    fileName: row.fileName,
    fileSize: row.fileSize,
    connectionLabel,
    tables: row.tables,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
};

export const listSources = async (userId: string) => {
  const rows = await db
    .select()
    .from(schema.dataSources)
    .where(eq(schema.dataSources.userId, userId))
    .orderBy(desc(schema.dataSources.createdAt));
  return rows.map(toDataSource);
};

export const getSourceRow = async (userId: string, id: string) => {
  const [row] = await db
    .select()
    .from(schema.dataSources)
    .where(and(eq(schema.dataSources.id, id), eq(schema.dataSources.userId, userId)));
  if (!row) throw notFound("Fonte de dados", "a");
  return row;
};

const finish = async (id: string, patch: Partial<SourceRow>) => {
  const [row] = await db
    .update(schema.dataSources)
    .set(patch)
    .where(eq(schema.dataSources.id, id))
    .returning();
  return toDataSource(row);
};

/** Upload CSV/XLSX: grava o arquivo, carrega no DuckDB e calcula o perfil das colunas. */
export const createFromUpload = async (
  userId: string,
  input: { name: string; description: string; file: File },
) => {
  const ext = path.extname(input.file.name).toLowerCase();
  const kind = ext === ".csv" || ext === ".txt" ? "csv" : ext === ".xlsx" ? "xlsx" : null;
  if (!kind) throw new HttpError(415, "Formato não suportado. Envie .csv ou .xlsx.");
  if (input.file.size === 0) throw new HttpError(400, "Arquivo vazio.");
  if (input.file.size > MAX_UPLOAD_BYTES) {
    throw new HttpError(413, `Arquivo maior que ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  }

  const id = randomUUID();
  await db.insert(schema.dataSources).values({
    id,
    userId,
    name: input.name.trim() || input.file.name,
    description: input.description.trim(),
    kind,
    status: "processando",
    fileName: input.file.name,
    fileSize: input.file.size,
  });

  try {
    await mkdir(sourceDir(id), { recursive: true });
    const original = path.join(sourceDir(id), `original${ext}`);
    await writeFile(original, Buffer.from(await input.file.arrayBuffer()));
    const tables = kind === "csv" ? await ingestCsv(id, original, input.file.name) : await ingestXlsx(id, original);
    return await finish(id, { status: "pronta", tables, error: null });
  } catch (error) {
    const message = error instanceof HttpError ? error.message : "Falha ao processar o arquivo.";
    if (!(error instanceof HttpError)) console.error("[sigdata] ingestão", error);
    return finish(id, { status: "erro", error: message });
  }
};

/** Conexão Postgres externa: testa, lê o schema e guarda a credencial criptografada. */
export const createPostgres = async (
  userId: string,
  input: { name: string; description: string; connection: PostgresConnectionInput },
) => {
  const tables = await introspectPg(input.connection);
  if (tables.length === 0) {
    throw new HttpError(422, "Conectou, mas nenhuma tabela visível foi encontrada para este usuário.");
  }
  const [row] = await db
    .insert(schema.dataSources)
    .values({
      id: randomUUID(),
      userId,
      name: input.name.trim() || input.connection.database,
      description: input.description.trim(),
      kind: "postgresql",
      status: "pronta",
      connection: encryptJson(input.connection),
      tables,
    })
    .returning();
  return toDataSource(row);
};

export const testPostgres = async (connection: PostgresConnectionInput) => {
  const tables = await introspectPg(connection);
  return { ok: true as const, tables: tables.length };
};

/** Relê o schema (útil quando o banco externo mudou). */
export const refreshSource = async (userId: string, id: string) => {
  const row = await getSourceRow(userId, id);
  if (row.kind !== "postgresql") return toDataSource(row);
  const tables = await introspectPg(connectionOf(row));
  return finish(id, { tables, status: "pronta", error: null });
};

export const updateSourceMeta = async (
  userId: string,
  id: string,
  patch: { name?: string; description?: string },
) => {
  await getSourceRow(userId, id);
  return finish(id, {
    ...(patch.name !== undefined && { name: patch.name.trim() || "Fonte sem nome" }),
    ...(patch.description !== undefined && { description: patch.description.trim() }),
  });
};

export const deleteSource = async (userId: string, id: string) => {
  const row = await getSourceRow(userId, id);
  await db.delete(schema.dataSources).where(eq(schema.dataSources.id, row.id));
  if (row.kind !== "postgresql") await removeDuckFiles(row.id).catch(() => undefined);
};

const findTable = (row: SourceRow, table: string) => {
  const found = row.tables.find((entry) => entry.name === table);
  if (!found) throw notFound("Tabela", "a");
  return found;
};

const assertReady = (row: SourceRow) => {
  if (row.status !== "pronta") {
    throw new HttpError(409, row.status === "erro" ? `Fonte com erro: ${row.error}` : "Fonte ainda em processamento.");
  }
};

const execute = (row: SourceRow, sql: string, limit?: number) =>
  row.kind === "postgresql" ? queryPg(connectionOf(row), sql, limit) : queryDuck(row.id, sql, limit);

export const previewTable = async (userId: string, id: string, table: string): Promise<TablePreview> => {
  const row = await getSourceRow(userId, id);
  assertReady(row);
  const found = findTable(row, table);
  const out = await execute(row, `SELECT * FROM ${quoteQualified(found.name)}`, PREVIEW_ROWS);
  return { table: found.name, columns: out.columns, rows: out.rows };
};

/** Perfil de colunas: arquivos já têm (calculado na ingestão); Postgres calcula e guarda no cache. */
export const profileTable = async (userId: string, id: string, table: string): Promise<SourceTable> => {
  const row = await getSourceRow(userId, id);
  assertReady(row);
  const found = findTable(row, table);
  if (row.kind !== "postgresql" || found.columns.every((column) => column.profile)) return found;
  const profiled = await profilePgTable(connectionOf(row), found);
  await finish(id, { tables: row.tables.map((entry) => (entry.name === found.name ? profiled : entry)) });
  return profiled;
};

export const toAnalyticResult = (row: typeof schema.results.$inferSelect): AnalyticResult => ({
  id: row.id,
  title: row.title,
  sql: row.sql,
  sourceId: row.sourceId,
  columns: row.columns,
  rows: row.rows,
  rowCount: row.rowCount,
  truncated: row.truncated,
  durationMs: row.durationMs,
  createdAt: row.createdAt.toISOString(),
});

/** Executa SQL de leitura numa fonte e grava o resultado (é o que a IA usa). */
export const runQuery = async (
  userId: string,
  input: { sourceId: string; sql: string; title: string; projectId?: string | null },
): Promise<AnalyticResult> => {
  const row = await getSourceRow(userId, input.sourceId);
  assertReady(row);
  const sql = assertReadOnlySql(input.sql);
  const out = await execute(row, sql);
  const [saved] = await db
    .insert(schema.results)
    .values({
      id: randomUUID(),
      userId,
      projectId: input.projectId ?? null,
      sourceId: row.id,
      title: input.title.trim().slice(0, 160) || "Consulta",
      sql,
      columns: out.columns,
      rows: out.rows,
      rowCount: out.rows.length,
      truncated: out.truncated,
      durationMs: out.durationMs,
    })
    .returning();
  return toAnalyticResult(saved);
};

export const getResult = async (userId: string, id: string) => {
  const [row] = await db
    .select()
    .from(schema.results)
    .where(and(eq(schema.results.id, id), eq(schema.results.userId, userId)));
  if (!row) throw notFound("Resultado");
  return toAnalyticResult(row);
};

/** Fonte de demonstração consultável, criada no cadastro do usuário. */
export const createDemoSource = async (userId: string) => {
  const id = randomUUID();
  await db.insert(schema.dataSources).values({
    id,
    userId,
    name: "Indicadores municipais (demonstração)",
    description: "Dados fictícios: índice, receita e variação por município e série mensal do índice geral.",
    kind: "demo",
    status: "processando",
  });
  const tables = await ingestRows(id, [
    {
      name: "municipios",
      rows: MUNICIPIOS.map((m) => ({
        municipio: m.nome,
        indice: m.indice,
        variacao_pct: m.variacao,
        receita_mi: m.receita,
      })),
    },
    {
      name: "serie_mensal",
      rows: SERIE_TEMPORAL.map((point, index) => ({
        mes: point.label,
        mes_num: index + 1,
        indice_geral: point.valor,
      })),
    },
  ]);
  await finish(id, { status: "pronta", tables });
  return id;
};
