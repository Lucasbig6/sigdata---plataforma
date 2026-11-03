import type { ColumnKind, ColumnProfile, SourceTable } from "@shared/domain/sources";
import { STEP_LABELS, type Step, type TargetType } from "@shared/domain/transform";
import { HttpError } from "../http";
import { quoteIdent, quoteQualified } from "./sql";

/** Motor que vai executar o SQL gerado; os tipos mudam entre os dois. */
export type Engine = "duckdb" | "postgres";

export type PipelineColumn = { name: string; kind: ColumnKind };

export type CompiledPipeline = {
  /** `WITH e0 AS (...), e1 AS (...) SELECT * FROM eN`, pronto para executar. */
  sql: string;
  /** Colunas que o resultado tem depois da última etapa. */
  columns: PipelineColumn[];
};

export const MAX_PIPELINE_STEPS = 50;
const MAX_NAME_LENGTH = 128;
const MAX_TEXT_VALUE = 1000;

export type PipelineError = HttpError & { stepIndex: number | null };

/**
 * Erro de uma etapa específica (índice a partir de 0), para a tela marcar a etapa com problema.
 * É uma função, e não `class extends HttpError`, porque `http` participa de um ciclo de imports
 * e a classe ainda não existe quando este módulo é avaliado.
 */
export const pipelineError = (stepIndex: number | null, message: string): PipelineError =>
  Object.assign(new HttpError(422, message), { stepIndex });

const isPipelineError = (error: unknown): error is PipelineError =>
  error instanceof HttpError && "stepIndex" in error;

const CAST_TYPES: Record<Engine, Record<TargetType, string>> = {
  duckdb: { numero: "DOUBLE", texto: "VARCHAR", data: "DATE", booleano: "BOOLEAN" },
  postgres: { numero: "DOUBLE PRECISION", texto: "VARCHAR", data: "DATE", booleano: "BOOLEAN" },
};

const SQL_COMPARISON = { "=": "=", ">": ">", ">=": ">=", "<": "<", "<=": "<=" } as const;

const DATE_LITERAL = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?$/;

const quoteList = (names: string[]) => names.map(quoteIdent).join(", ");

const stringLiteral = (value: string) => {
  if (value.includes("\0")) throw new Error("O valor tem um caractere inválido.");
  if (value.length > MAX_TEXT_VALUE) throw new Error(`O valor passa de ${MAX_TEXT_VALUE} caracteres.`);
  return `'${value.replaceAll("'", "''")}'`;
};

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

const findColumn = (columns: PipelineColumn[], name: string) => {
  const found = columns.find((column) => column.name === name);
  if (!found) throw new Error(`A coluna "${name}" não existe neste ponto.`);
  return found;
};

const requireColumns = (columns: PipelineColumn[], names: string[]) => {
  const unique = [...new Set(names)];
  for (const name of unique) findColumn(columns, name);
  return unique;
};

/** Condição de uma etapa "filtrar", com o valor convertido ao tipo da coluna. */
const filterCondition = (step: Extract<Step, { type: "filtrar" }>, column: PipelineColumn) => {
  const ref = quoteIdent(column.name);
  if (step.op === "nulo") return `${ref} IS NULL`;
  if (step.op === "nao_nulo") return `${ref} IS NOT NULL`;
  if (step.value === undefined || step.value === "") throw new Error("Informe o valor do filtro.");

  if (step.op === "contem") {
    const pattern = stringLiteral(`%${escapeLike(String(step.value))}%`);
    return `CAST(${ref} AS VARCHAR) ILIKE ${pattern} ESCAPE '\\'`;
  }

  let literal: string;
  if (column.kind === "numero") {
    const value = typeof step.value === "number" ? step.value : Number(String(step.value).replace(",", "."));
    if (!Number.isFinite(value)) throw new Error(`"${step.value}" não é um número.`);
    literal = String(value);
  } else if (column.kind === "booleano") {
    if (step.op !== "=" && step.op !== "!=") throw new Error("Colunas verdadeiro/falso só aceitam igual ou diferente.");
    const text = String(step.value).toLowerCase();
    if (!["true", "false"].includes(text)) throw new Error("Use verdadeiro ou falso.");
    literal = text.toUpperCase();
  } else if (column.kind === "data") {
    const text = String(step.value).trim();
    if (!DATE_LITERAL.test(text)) throw new Error(`"${text}" não é uma data (use AAAA-MM-DD).`);
    literal = stringLiteral(text);
  } else {
    literal = stringLiteral(String(step.value));
  }

  const target = column.kind === "outro" ? `CAST(${ref} AS VARCHAR)` : ref;
  // "diferente de" inclui as linhas nulas, como a pessoa espera de "não é X"
  if (step.op === "!=") return `${target} IS DISTINCT FROM ${literal}`;
  return `${target} ${SQL_COMPARISON[step.op]} ${literal}`;
};

type Order = { column: string; dir: "asc" | "desc" };

type State = {
  columns: PipelineColumn[];
  /** Ordenação pedida pela última etapa "ordenar"; aplicada no SELECT final. */
  order: Order | null;
};

/**
 * Aplica uma etapa: devolve o SELECT da nova CTE (ou `null` quando a etapa
 * só muda a ordenação) e o novo estado das colunas.
 */
const applyStep = (step: Step, previous: string, state: State, engine: Engine): { body: string | null; state: State } => {
  const { columns } = state;
  switch (step.type) {
    case "filtrar": {
      const column = findColumn(columns, step.column);
      return { body: `SELECT * FROM ${previous} WHERE ${filterCondition(step, column)}`, state };
    }
    case "renomear": {
      findColumn(columns, step.from);
      const to = step.to.trim();
      if (!to) throw new Error("Informe o novo nome.");
      if (to.length > MAX_NAME_LENGTH) throw new Error(`O nome passa de ${MAX_NAME_LENGTH} caracteres.`);
      // eslint-disable-next-line no-control-regex
      if (/[\u0000-\u001f]/.test(to)) throw new Error("O nome tem caracteres inválidos.");
      const clash = columns.some((column) => column.name !== step.from && column.name.toLowerCase() === to.toLowerCase());
      if (clash) throw new Error(`Já existe uma coluna "${to}".`);
      const list = columns
        .map((column) => (column.name === step.from ? `${quoteIdent(column.name)} AS ${quoteIdent(to)}` : quoteIdent(column.name)))
        .join(", ");
      return {
        body: `SELECT ${list} FROM ${previous}`,
        state: {
          columns: columns.map((column) => (column.name === step.from ? { ...column, name: to } : column)),
          order: state.order?.column === step.from ? { ...state.order, column: to } : state.order,
        },
      };
    }
    case "remover": {
      const names = requireColumns(columns, step.columns);
      if (names.length === 0) throw new Error("Escolha ao menos uma coluna.");
      const kept = columns.filter((column) => !names.includes(column.name));
      if (kept.length === 0) throw new Error("Não é possível remover todas as colunas.");
      return {
        body: `SELECT ${quoteList(kept.map((column) => column.name))} FROM ${previous}`,
        state: {
          columns: kept,
          // a ordenação some junto com a coluna que a definia
          order: state.order && names.includes(state.order.column) ? null : state.order,
        },
      };
    }
    case "tipo": {
      findColumn(columns, step.column);
      const type = CAST_TYPES[engine][step.to];
      if (!type) throw new Error("Tipo inválido.");
      // no DuckDB o que não converte vira nulo; no Postgres a conversão falha com o motivo
      const cast = engine === "duckdb" ? "TRY_CAST" : "CAST";
      const list = columns
        .map((column) =>
          column.name === step.column
            ? `${cast}(${quoteIdent(column.name)} AS ${type}) AS ${quoteIdent(column.name)}`
            : quoteIdent(column.name),
        )
        .join(", ");
      return {
        body: `SELECT ${list} FROM ${previous}`,
        state: {
          columns: columns.map((column) => (column.name === step.column ? { ...column, kind: step.to } : column)),
          order: state.order,
        },
      };
    }
    case "ordenar": {
      findColumn(columns, step.column);
      return { body: null, state: { columns, order: { column: step.column, dir: step.dir } } };
    }
    case "remover_nulos": {
      const names = requireColumns(columns, step.columns);
      if (names.length === 0) throw new Error("Escolha ao menos uma coluna.");
      const where = names.map((name) => `${quoteIdent(name)} IS NOT NULL`).join(" AND ");
      return { body: `SELECT * FROM ${previous} WHERE ${where}`, state };
    }
    case "duplicadas": {
      // lista vazia = linha inteira
      const names = step.columns.length === 0 ? columns.map((column) => column.name) : requireColumns(columns, step.columns);
      const all = quoteList(columns.map((column) => column.name));
      return {
        body:
          `SELECT ${all} FROM (SELECT ${all}, ROW_NUMBER() OVER (PARTITION BY ${quoteList(names)}) AS sigdata_rn__ ` +
          `FROM ${previous}) AS sigdata_d WHERE sigdata_rn__ = 1`,
        state,
      };
    }
  }
};

/**
 * Compila a lista de etapas em uma única consulta SQL de leitura.
 * Nomes de colunas passam por `quoteIdent` e valores viram literais escapados;
 * nada vindo do usuário é concatenado cru.
 */
export const compilePipeline = (table: SourceTable, steps: Step[], engine: Engine): CompiledPipeline => {
  if (steps.length > MAX_PIPELINE_STEPS) {
    throw pipelineError(null, `Use no máximo ${MAX_PIPELINE_STEPS} etapas.`);
  }
  const ids = new Set<string>();
  for (const step of steps) {
    if (ids.has(step.id)) throw pipelineError(null, "Há etapas com o mesmo identificador.");
    ids.add(step.id);
  }

  let state: State = {
    columns: table.columns.map((column) => ({ name: column.name, kind: column.kind })),
    order: null,
  };
  const ctes = [`e0 AS (SELECT ${quoteList(state.columns.map((column) => column.name))} FROM ${quoteQualified(table.name)})`];
  let last = "e0";

  steps.forEach((step, index) => {
    try {
      const applied = applyStep(step, last, state, engine);
      state = applied.state;
      if (applied.body) {
        last = `e${ctes.length}`;
        ctes.push(`${last} AS (${applied.body})`);
      }
    } catch (error) {
      if (isPipelineError(error)) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      throw pipelineError(index, `Etapa ${index + 1} (${STEP_LABELS[step.type]}): ${reason}`);
    }
  });

  const order = state.order
    ? ` ORDER BY ${quoteIdent(state.order.column)} ${state.order.dir === "desc" ? "DESC" : "ASC"} NULLS LAST`
    : "";
  return { sql: `WITH ${ctes.join(",\n")}\nSELECT * FROM ${last}${order}`, columns: state.columns };
};

/** Consulta única que mede nulos, distintos, mínimo, máximo e média de cada coluna do resultado. */
export const profileSql = (pipelineSql: string, columns: PipelineColumn[], engine: Engine) => {
  const parts = ["COUNT(*) AS total"];
  columns.forEach((column, i) => {
    const ref = quoteIdent(column.name);
    parts.push(`COUNT(${ref}) AS c${i}`, `COUNT(DISTINCT ${ref}) AS d${i}`);
    if (column.kind === "numero" || column.kind === "data") {
      parts.push(`CAST(MIN(${ref}) AS VARCHAR) AS mn${i}`, `CAST(MAX(${ref}) AS VARCHAR) AS mx${i}`);
    }
    if (column.kind === "numero") parts.push(`CAST(AVG(${ref}) AS ${CAST_TYPES[engine].numero}) AS av${i}`);
  });
  return `SELECT ${parts.join(", ")} FROM (${pipelineSql}\n) AS sigdata_p`;
};

/** Converte a linha devolvida por `profileSql` em um perfil por coluna. */
export const readProfile = (columns: PipelineColumn[], row: Record<string, unknown>) => {
  const total = Number(row.total ?? 0);
  const profiles: Record<string, ColumnProfile> = {};
  columns.forEach((column, i) => {
    const nulos = total - Number(row[`c${i}`] ?? 0);
    profiles[column.name] = {
      nulos,
      nulosPct: total > 0 ? Math.round((nulos / total) * 10000) / 100 : 0,
      distintos: row[`d${i}`] == null ? null : Number(row[`d${i}`]),
      min: row[`mn${i}`] == null ? null : String(row[`mn${i}`]),
      max: row[`mx${i}`] == null ? null : String(row[`mx${i}`]),
      media: row[`av${i}`] == null ? null : Number(row[`av${i}`]),
    };
  });
  return { total, profiles };
};
