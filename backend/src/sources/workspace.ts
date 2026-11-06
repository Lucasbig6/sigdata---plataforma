import type { SourceTable } from "@shared/domain/sources";
import type { QueryDef, Step, Workspace } from "@shared/domain/transform";
import { HttpError } from "../http";
import {
  assertReady,
  createDatasetFromPlan,
  execute,
  findTable,
  getSourceRow,
  runPage,
  type Executor,
  type PageInput,
  type SourceRow,
} from "./service";
import { compilePipeline, profileSql, readProfile, type CompiledPipeline, type Engine } from "./pipeline";
import { openScratch } from "./scratch";
import { quoteIdent, type QueryOutput } from "./sql";

/** Linhas lidas de cada consulta ao combinar (a junção acontece em memória, numa cópia). */
export const MAX_COMBINE_ROWS = 50_000;
const MAX_QUERIES = 8;
const MAX_DEPTH = 5;
const MAX_STEPS_TOTAL = 400;
const DISTINCT_LIMIT = 50;

const engineOf = (row: SourceRow): Engine => (row.kind === "postgresql" ? "postgres" : "duckdb");

/**
 * MySQL e SQL Server não têm o dialeto das etapas: as linhas da tabela (até MAX_COMBINE_ROWS) são
 * copiadas, em leitura, para a área em memória, e as etapas rodam lá.
 */
const copiesToMemory = (row: SourceRow) => row.kind === "mysql" || row.kind === "sqlserver";

const usesQuery = (step: Step) => step.type === "acrescentar" || (step.type === "mesclar" && Boolean(step.query));

const referencedQueries = (steps: Step[]) => [
  ...new Set(steps.flatMap((step) => (step.type === "acrescentar" ? [step.query] : step.type === "mesclar" && step.query ? [step.query] : []))),
];

/** Como executar o resultado de uma consulta: o SQL pronto e onde ele roda. */
export type Plan = {
  compiled: CompiledPipeline;
  exec: Executor;
  /** Dialeto do SQL gerado (muda ao combinar: o resto roda em DuckDB, em memória). */
  engine: Engine;
  /** Fonte de origem da consulta final (para registrar o dataset). */
  origin: SourceRow;
  close: () => void;
};

const validate = (workspace: Workspace) => {
  const { queries, target } = workspace;
  if (queries.length > MAX_QUERIES) throw new HttpError(422, `Use no máximo ${MAX_QUERIES} consultas.`);
  if (queries.reduce((sum, query) => sum + query.steps.length, 0) > MAX_STEPS_TOTAL) {
    throw new HttpError(422, "Há etapas demais no espaço de trabalho.");
  }
  const ids = new Set(queries.map((query) => query.id));
  if (ids.size !== queries.length) throw new HttpError(422, "Há consultas com o mesmo identificador.");
  if (!ids.has(target)) throw new HttpError(422, "A consulta de destino não existe.");
};

/**
 * Prepara a execução de uma consulta. Sem combinar consultas, tudo roda na própria fonte
 * (somente leitura). Com combinação, o trecho até a primeira junção roda na origem, as linhas
 * (até MAX_COMBINE_ROWS) são copiadas para uma área em memória e o resto roda lá.
 */
const buildPlan = async (
  userId: string,
  queries: QueryDef[],
  id: string,
  options: { upTo?: number | undefined; stack: string[] },
): Promise<Plan> => {
  const query = queries.find((entry) => entry.id === id);
  if (!query) throw new HttpError(422, "A consulta escolhida não existe.");
  if (options.stack.includes(id) || options.stack.length >= MAX_DEPTH) {
    throw new HttpError(422, "As consultas dependem umas das outras em ciclo (ou aninham demais).");
  }

  const row = await getSourceRow(userId, query.sourceId);
  assertReady(row);
  const table = findTable(row, query.table);
  const steps = options.upTo === undefined ? query.steps : query.steps.slice(0, options.upTo);
  const engine = engineOf(row);
  const split = copiesToMemory(row) ? 0 : steps.findIndex(usesQuery);

  if (split < 0) {
    const compiled = compilePipeline(table, steps, engine, row.tables);
    return { compiled, exec: (sql, limit, offset) => execute(row, sql, limit, offset), engine, origin: row, close: () => undefined };
  }

  // 1) trecho que roda na origem
  const prefix = compilePipeline(table, steps.slice(0, split), copiesToMemory(row) ? "postgres" : engine, row.tables);
  const base = await execute(row, prefix.sql, MAX_COMBINE_ROWS);
  assertWithinLimit(base, query.name);

  // 2) consultas referenciadas, resolvidas por inteiro
  const scratch = await openScratch();
  try {
    const baseTable = await scratch.load("__base", base.columns, base.rows);
    const queryTables: Record<string, SourceTable> = {};
    for (const [index, refId] of referencedQueries(steps.slice(split)).entries()) {
      if (refId === id) throw new HttpError(422, "Uma consulta não pode combinar com ela mesma.");
      const plan = await buildPlan(userId, queries, refId, { stack: [...options.stack, id] });
      try {
        const out = await plan.exec(plan.compiled.sql, MAX_COMBINE_ROWS);
        assertWithinLimit(out, queries.find((entry) => entry.id === refId)?.name ?? "outra consulta");
        queryTables[refId] = await scratch.load(`__q${index}`, out.columns, out.rows);
      } finally {
        plan.close();
      }
    }

    // 3) o resto roda em memória
    const suffix = compilePipeline(baseTable, steps.slice(split), "duckdb", [baseTable], queryTables, split);
    const compiled: CompiledPipeline = { ...suffix, stepSql: [...prefix.stepSql, ...suffix.stepSql] };
    return { compiled, exec: scratch.execute, engine: "duckdb", origin: row, close: scratch.close };
  } catch (error) {
    scratch.close();
    throw error;
  }
};

const assertWithinLimit = (out: QueryOutput, name: string) => {
  if (out.truncated) {
    throw new HttpError(
      413,
      `"${name}" tem mais de ${MAX_COMBINE_ROWS.toLocaleString("pt-BR")} linhas. Filtre ou agregue antes de combinar.`,
    );
  }
};

const withPlan = async <T>(
  userId: string,
  workspace: Workspace,
  upTo: number | undefined,
  fn: (plan: Plan) => Promise<T>,
) => {
  validate(workspace);
  const plan = await buildPlan(userId, workspace.queries, workspace.target, { upTo, stack: [] });
  try {
    return await fn(plan);
  } finally {
    plan.close();
  }
};

/** Prévia paginada do resultado, sem gravar nada em lugar nenhum. */
export const runWorkspace = (
  userId: string,
  input: PageInput & { workspace: Workspace; upTo?: number | undefined },
) =>
  withPlan(userId, input.workspace, input.upTo, async (plan) => {
    const page = await runPage(plan.exec, plan.compiled.sql, input);
    return { ...page, sql: plan.compiled.sql, stepSql: plan.compiled.stepSql };
  });

/** Perfil (nulos, distintos, min/max, média) das colunas do resultado. */
export const profileWorkspace = (userId: string, input: { workspace: Workspace; upTo?: number | undefined }) =>
  withPlan(userId, input.workspace, input.upTo, async (plan) => {
    const out = await plan.exec(profileSql(plan.compiled.sql, plan.compiled.columns, plan.engine), 1);
    const { total, profiles } = readProfile(plan.compiled.columns, out.rows[0] ?? {});
    return { rowCount: total, columns: plan.compiled.columns.map((column) => ({ ...column, profile: profiles[column.name] })) };
  });

/** Valores distintos de uma coluna do resultado (para escolher o que filtrar ou dinamizar). */
export const distinctWorkspaceValues = (
  userId: string,
  input: { workspace: Workspace; upTo?: number | undefined; column: string },
) =>
  withPlan(userId, input.workspace, input.upTo, async (plan) => {
    if (!plan.compiled.columns.some((column) => column.name === input.column)) {
      throw new HttpError(422, `A coluna "${input.column}" não existe neste ponto.`);
    }
    const ref = quoteIdent(input.column);
    const out = await plan.exec(
      `SELECT DISTINCT CAST(${ref} AS VARCHAR) AS v FROM (${plan.compiled.sql}\n) AS sigdata_v WHERE ${ref} IS NOT NULL ORDER BY 1`,
      DISTINCT_LIMIT,
    );
    return { values: out.rows.map((entry) => String(entry.v)), truncated: out.truncated };
  });

/** Salva o resultado do espaço de trabalho como dataset (cópia: nenhuma origem é alterada). */
export const createDatasetFromWorkspace = (
  userId: string,
  input: { workspace: Workspace; name: string; description: string },
) =>
  withPlan(userId, input.workspace, undefined, (plan) =>
    createDatasetFromPlan(userId, { ...input, sql: plan.compiled.sql, origin: plan.origin, exec: plan.exec }),
  );
