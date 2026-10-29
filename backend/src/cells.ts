import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, max } from "drizzle-orm";
import { MAX_CELLS_PER_PROJECT, type SqlCell } from "@shared/domain/cells";
import { isWorkspaceSource } from "@shared/domain/sources";
import { db, schema } from "./db";
import { HttpError, notFound } from "./http";
import { getSourceRow, runQuery, toAnalyticResult } from "./sources/service";

type CellRow = typeof schema.notebookCells.$inferSelect;
type ResultRow = typeof schema.results.$inferSelect;
type ProjectRow = typeof schema.projects.$inferSelect;

const toCell = (row: CellRow, result: ResultRow | null): SqlCell => ({
  id: row.id,
  projectId: row.projectId,
  afterMessageId: row.afterMessageId,
  position: row.position,
  title: row.title,
  sql: row.sql,
  sourceId: row.sourceId,
  result: result ? toAnalyticResult(result) : null,
  runNumber: row.runNumber,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const selectCells = (projectId: string) =>
  db
    .select({ cell: schema.notebookCells, result: schema.results })
    .from(schema.notebookCells)
    .leftJoin(schema.results, eq(schema.results.id, schema.notebookCells.resultId))
    .where(eq(schema.notebookCells.projectId, projectId))
    .orderBy(asc(schema.notebookCells.position), asc(schema.notebookCells.createdAt));

export const listCells = async (projectId: string) =>
  (await selectCells(projectId)).map(({ cell, result }) => toCell(cell, result));

const getCellRow = async (projectId: string, cellId: string) => {
  const [row] = await db
    .select()
    .from(schema.notebookCells)
    .where(and(eq(schema.notebookCells.id, cellId), eq(schema.notebookCells.projectId, projectId)));
  if (!row) throw notFound("Célula", "a");
  return row;
};

const getCell = async (projectId: string, cellId: string) => {
  const found = (await selectCells(projectId)).find(({ cell }) => cell.id === cellId);
  if (!found) throw notFound("Célula", "a");
  return toCell(found.cell, found.result);
};

export const createCell = async (
  projectId: string,
  input: { afterMessageId: string | null; sql: string; title: string },
) => {
  const all = await db
    .select({ id: schema.notebookCells.id })
    .from(schema.notebookCells)
    .where(eq(schema.notebookCells.projectId, projectId));
  if (all.length >= MAX_CELLS_PER_PROJECT) {
    throw new HttpError(409, `O notebook atingiu o limite de ${MAX_CELLS_PER_PROJECT} células SQL.`);
  }
  // a célula nova entra no fim do grupo que fica depois da mesma mensagem
  const [last] = await db
    .select({ position: max(schema.notebookCells.position) })
    .from(schema.notebookCells)
    .where(
      and(
        eq(schema.notebookCells.projectId, projectId),
        input.afterMessageId === null
          ? isNull(schema.notebookCells.afterMessageId)
          : eq(schema.notebookCells.afterMessageId, input.afterMessageId),
      ),
    );
  const id = randomUUID();
  await db.insert(schema.notebookCells).values({
    id,
    projectId,
    afterMessageId: input.afterMessageId,
    position: (last?.position ?? -1) + 1,
    sql: input.sql,
    title: input.title.trim(),
  });
  return getCell(projectId, id);
};

export const updateCell = async (projectId: string, cellId: string, patch: { sql?: string; title?: string }) => {
  await getCellRow(projectId, cellId);
  await db
    .update(schema.notebookCells)
    .set({
      ...(patch.sql !== undefined && { sql: patch.sql }),
      ...(patch.title !== undefined && { title: patch.title.trim() }),
    })
    .where(eq(schema.notebookCells.id, cellId));
  return getCell(projectId, cellId);
};

export const deleteCell = async (projectId: string, cellId: string) => {
  await getCellRow(projectId, cellId);
  await db.delete(schema.notebookCells).where(eq(schema.notebookCells.id, cellId));
};

/** Executa a célula no dataset ativo do projeto e guarda o resultado (com o nº da execução). */
export const runCell = async (userId: string, project: ProjectRow, cellId: string) => {
  const cell = await getCellRow(project.id, cellId);
  if (!cell.sql.trim()) throw new HttpError(400, "A célula está vazia.");
  if (!project.sourceId) throw new HttpError(400, "Escolha um dataset para o projeto antes de executar.");
  const source = await getSourceRow(project.sourceId);
  if (!isWorkspaceSource(source)) throw new HttpError(400, "O notebook só executa SQL em datasets prontos.");

  const result = await runQuery(userId, {
    sourceId: source.id,
    projectId: project.id,
    sql: cell.sql,
    title: cell.title || "Célula SQL",
  });
  const [counter] = await db
    .select({ last: max(schema.notebookCells.runNumber) })
    .from(schema.notebookCells)
    .where(eq(schema.notebookCells.projectId, project.id));
  await db
    .update(schema.notebookCells)
    .set({ resultId: result.id, sourceId: source.id, runNumber: (counter?.last ?? 0) + 1 })
    .where(eq(schema.notebookCells.id, cell.id));
  return getCell(project.id, cell.id);
};

const PROMPT_CELLS = 6;

/**
 * Células SQL executadas, resumidas para o prompt da IA (sem linhas: o limite de
 * tokens por minuto é curto). Com o resultId a IA pode desenhar o resultado.
 */
export const describeCellsForPrompt = async (projectId: string) => {
  const cells = (await listCells(projectId)).filter((cell) => cell.result).slice(-PROMPT_CELLS);
  if (cells.length === 0) return "";
  const lines = cells.map((cell) => {
    const result = cell.result!;
    const cols = result.columns.map((column) => column.name).join(", ");
    const sql = cell.sql.replace(/\s+/g, " ").trim().slice(0, 400);
    return `- [${cell.runNumber ?? "?"}] "${cell.title || "Célula SQL"}" resultId=${result.id} · ${result.rowCount} linha(s) · colunas: ${cols}\n  SQL: ${sql}`;
  });
  return [
    "Células SQL que o usuário executou no notebook (mais recentes por último). Use o resultId",
    "em create_visualization quando ele pedir para desenhar um desses resultados:",
    ...lines,
  ].join("\n");
};
