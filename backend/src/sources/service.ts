import { invalidateSourceCache } from "../query-cache";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, desc, eq, or, sql } from "drizzle-orm";
import type {
  AnalyticResult,
  DataSource,
  PostgresConnectionInput,
  SourceTable,
  TablePreview,
} from "@shared/domain/sources";
import type { Workspace } from "@shared/domain/transform";
import { MUNICIPIOS, SERIE_TEMPORAL } from "@shared/demo-data";
import type { Role } from "@shared/roles";
import { decryptJson, encryptJson } from "../crypto";
import { db, schema } from "../db";
import { HttpError, notFound } from "../http";
import { ingestCsv, ingestRows, ingestXlsx, queryDuck, removeDuckFiles, sourceDir } from "./duck";
import { introspectPg, profilePgTable, queryPg } from "./pg";
import { assertReadOnlySql, quoteQualified, toTableName, type QueryOutput } from "./sql";

export type SourceRow = typeof schema.dataSources.$inferSelect;

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
    definition: row.definition ?? null,
    published: row.published,
    tables: row.tables,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
};

/** Quem pede: o usuário da sessão (id + papel). */
export type Actor = { id: string; role: Role };

/**
 * Fontes que a pessoa enxerga: as próprias (incluindo a de demonstração) e os datasets
 * publicados por analistas. O admin enxerga todas.
 */
export const listSources = async (actor: Actor) => {
  const rows = await db
    .select()
    .from(schema.dataSources)
    .where(
      actor.role === "admin"
        ? undefined
        : or(eq(schema.dataSources.userId, actor.id), eq(schema.dataSources.published, true)),
    )
    .orderBy(desc(schema.dataSources.createdAt));
  return rows.map(toDataSource);
};

/**
 * Fonte para USO (consultar, visualizar, ligar a dashboards): a própria ou um dataset
 * publicado. Fontes de outras pessoas, e rascunhos, respondem como inexistentes.
 */
export const getSourceRow = async (userId: string, id: string) => {
  const [row] = await db
    .select()
    .from(schema.dataSources)
    .where(
      and(
        eq(schema.dataSources.id, id),
        or(eq(schema.dataSources.userId, userId), eq(schema.dataSources.published, true)),
      ),
    );
  if (!row) throw notFound("Fonte de dados", "a");
  return row;
};

/** Fonte para GERENCIAR (editar, atualizar, excluir, publicar): a própria, ou qualquer uma para o admin. */
export const getManagedSource = async (actor: Actor, id: string) => {
  const [row] = await db
    .select()
    .from(schema.dataSources)
    .where(
      actor.role === "admin"
        ? eq(schema.dataSources.id, id)
        : and(eq(schema.dataSources.id, id), eq(schema.dataSources.userId, actor.id)),
    );
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
export const refreshSource = async (actor: Actor, id: string) => {
  const row = await getManagedSource(actor, id);
  if (row.kind !== "postgresql") return toDataSource(row);
  const tables = await introspectPg(connectionOf(row));
  return finish(id, { tables, status: "pronta", error: null });
};

export const updateSourceMeta = async (
  actor: Actor,
  id: string,
  patch: { name?: string; description?: string },
) => {
  await getManagedSource(actor, id);
  return finish(id, {
    ...(patch.name !== undefined && { name: patch.name.trim() || "Fonte sem nome" }),
    ...(patch.description !== undefined && { description: patch.description.trim() }),
  });
};

export type SourceUsage = { dashboards: number; projects: number; people: number };

/**
 * Onde uma fonte/dataset está em uso: dashboards que a ligam (pelo `sourceId` nos elementos),
 * projetos que a têm como fonte ativa e quantas pessoas isso envolve (fora o dono da fonte).
 */
export const sourceUsage = async (actor: Actor, id: string): Promise<SourceUsage> => {
  const row = await getManagedSource(actor, id);
  const pattern = `%"sourceId": "${id}"%`;
  const dashboards = await db
    .select({ userId: schema.dashboards.userId })
    .from(schema.dashboards)
    .where(sql`${schema.dashboards.doc}::text LIKE ${pattern}`);
  const projects = await db
    .select({ userId: schema.projects.userId })
    .from(schema.projects)
    .where(eq(schema.projects.sourceId, id));
  const people = new Set([...dashboards, ...projects].map((entry) => entry.userId));
  people.delete(row.userId);
  return { dashboards: dashboards.length, projects: projects.length, people: people.size };
};

/** Impede quebrar o que outras pessoas usam sem confirmação explícita (`force`). */
const assertUnusedOrForced = async (actor: Actor, id: string, force: boolean) => {
  if (force) return;
  const usage = await sourceUsage(actor, id);
  if (usage.dashboards + usage.projects > 0) {
    throw new HttpError(
      409,
      `Em uso por ${usage.dashboards} dashboard(s) e ${usage.projects} projeto(s) (${usage.people} outra(s) pessoa(s)). Confirme para continuar.`,
    );
  }
};

/** Publica ou retira da publicação um dataset pronto (só datasets são publicados). */
export const setPublished = async (actor: Actor, id: string, published: boolean, force = false) => {
  const row = await getManagedSource(actor, id);
  if (row.kind !== "dataset") throw new HttpError(400, "Só datasets podem ser publicados.");
  if (published) assertReady(row);
  else if (row.published) await assertUnusedOrForced(actor, id, force);
  invalidateSourceCache(row.id);
  return finish(row.id, { published });
};

export const deleteSource = async (actor: Actor, id: string, force = false) => {
  const row = await getManagedSource(actor, id);
  await assertUnusedOrForced(actor, id, force);
  await db.delete(schema.dataSources).where(eq(schema.dataSources.id, row.id));
  invalidateSourceCache(row.id);
  if (row.kind !== "postgresql") await removeDuckFiles(row.id).catch(() => undefined);
};

export const findTable = (row: SourceRow, table: string) => {
  const found = row.tables.find((entry) => entry.name === table);
  if (!found) throw notFound("Tabela", "a");
  return found;
};

export const assertReady = (row: SourceRow) => {
  if (row.status !== "pronta") {
    throw new HttpError(409, row.status === "erro" ? `Fonte com erro: ${row.error}` : "Fonte ainda em processamento.");
  }
};

export const execute = (row: SourceRow, sql: string, limit?: number, offset?: number) =>
  row.kind === "postgresql"
    ? queryPg(connectionOf(row), sql, limit, offset)
    : queryDuck(row.id, sql, limit, offset);

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

export const EDITOR_PAGE_SIZES = [25, 50, 100, 200, 500, 1000] as const;

/** Total de linhas de uma consulta (para "página X de N"); falha de contagem não derruba a página. */
/** Executa uma consulta e devolve até `limit` linhas a partir de `offset`. */
export type Executor = (sql: string, limit?: number, offset?: number) => Promise<QueryOutput>;

const countRows = async (exec: Executor, sql: string): Promise<number | null> => {
  try {
    const out = await exec(`SELECT COUNT(*) AS total FROM (${sql}\n) AS sigdata_c`, 1);
    const total = Number(Object.values(out.rows[0] ?? {})[0]);
    return Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
};

export type PageInput = { page: number; pageSize: number; count: boolean };

/** Uma página do resultado de `sql` (já validado), mais o total se pedido. */
export const runPage = async (exec: Executor, sql: string, input: PageInput) => {
  const offset = (input.page - 1) * input.pageSize;
  const [out, total] = await Promise.all([
    exec(sql, input.pageSize, offset),
    input.count ? countRows(exec, sql) : Promise.resolve(null),
  ]);
  return {
    columns: out.columns,
    rows: out.rows,
    hasMore: out.truncated,
    durationMs: out.durationMs,
    page: input.page,
    pageSize: input.pageSize,
    total,
  };
};

/**
 * Editor SQL do analista: devolve uma página do resultado, sem gravar nada.
 * `count` pede também o total de linhas (a primeira página faz; as seguintes reaproveitam).
 */
export const runEditorQuery = async (
  userId: string,
  input: PageInput & { sourceId: string; sql: string },
) => {
  const row = await getSourceRow(userId, input.sourceId);
  assertReady(row);
  return runPage((sql, limit, offset) => execute(row, sql, limit, offset), assertReadOnlySql(input.sql), input);
};

/** Teto de linhas de um dataset (fica inteiro em memória durante a criação). */
export const DATASET_ROW_LIMIT = 50_000;

/** Grava as linhas de um resultado como dataset da conta (uma cópia: a origem nunca é alterada). */
export const persistDataset = async (
  userId: string,
  input: {
    origin: SourceRow;
    sql: string;
    out: QueryOutput;
    workspace?: Workspace | undefined;
    name: string;
    description: string;
  },
) => {
  const { origin, out } = input;
  if (out.rows.length === 0) throw new HttpError(422, "A consulta não retornou linhas: não há o que salvar.");
  if (out.truncated) {
    throw new HttpError(
      413,
      `A consulta tem mais de ${DATASET_ROW_LIMIT.toLocaleString("pt-BR")} linhas. Filtre ou agregue antes de salvar.`,
    );
  }
  const id = randomUUID();
  const name = input.name.trim();
  await db.insert(schema.dataSources).values({
    id,
    userId,
    name,
    description: input.description.trim(),
    kind: "dataset",
    status: "processando",
    definition: {
      sourceId: origin.id,
      sourceName: origin.name,
      sql: input.sql,
      rowCount: out.rows.length,
      ...(input.workspace ? { workspace: input.workspace } : {}),
    },
  });
  try {
    const tables = await ingestRows(id, [{ name: toTableName(name, new Set()), rows: out.rows }]);
    return await finish(id, { status: "pronta", tables, error: null });
  } catch (error) {
    console.error("[sigdata] criar dataset", error);
    await db.delete(schema.dataSources).where(eq(schema.dataSources.id, id));
    await removeDuckFiles(id).catch(() => undefined);
    throw new HttpError(500, "Não foi possível salvar o dataset.");
  }
};

/**
 * Cria um dataset a partir de uma consulta do editor SQL: roda a consulta e grava o
 * resultado como uma fonte própria (tabela no DuckDB), que o chat e os dashboards usam.
 */
export const createDataset = async (
  userId: string,
  input: { sourceId: string; sql: string; name: string; description: string },
) => {
  const origin = await getSourceRow(userId, input.sourceId);
  assertReady(origin);
  const sql = assertReadOnlySql(input.sql);
  const out = await execute(origin, sql, DATASET_ROW_LIMIT);
  return persistDataset(userId, { origin, sql, out, name: input.name, description: input.description });
};

/** Salva o resultado de uma execução já preparada (preparação de dados) como dataset. */
export const createDatasetFromPlan = async (
  userId: string,
  input: { workspace: Workspace; name: string; description: string; sql: string; origin: SourceRow; exec: Executor },
) => {
  const out = await input.exec(input.sql, DATASET_ROW_LIMIT);
  return persistDataset(userId, {
    origin: input.origin,
    sql: input.sql,
    out,
    workspace: input.workspace,
    name: input.name,
    description: input.description,
  });
};

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

export const listRecentResults = async (userId: string, limit = 40) => {
  const rows = await db
    .select({
      id: schema.results.id,
      title: schema.results.title,
      sql: schema.results.sql,
      sourceId: schema.results.sourceId,
      columns: schema.results.columns,
      rowCount: schema.results.rowCount,
      createdAt: schema.results.createdAt,
    })
    .from(schema.results)
    .where(eq(schema.results.userId, userId))
    .orderBy(desc(schema.results.createdAt))
    .limit(limit);
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
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
