/**
 * Dados ao vivo dos elementos de dashboard.
 *
 * Modo "builder": o SQL é montado aqui a partir de nomes validados contra o
 * schema cacheado da fonte (nunca texto livre do cliente) e os filtros entram
 * como literais escapados. Medidas calculadas passam por um analisador próprio
 * (shared/dashboards/expr.ts), que só gera SQL a partir de colunas validadas.
 * Modo "sql": a consulta do autor passa pela mesma barreira de somente-leitura
 * do chat.
 */
import type { ActiveFilter, BindingData, FilterOptions } from "@shared/dashboards/data";
import { FILTER_OPTIONS_LIMIT, FILTER_VALUE_MAX, parseRange } from "@shared/dashboards/data";
import { compileMeasure } from "@shared/dashboards/expr";
import {
  BINDING_LIMIT_MAX,
  type Aggregation,
  type DataBinding,
  type FilterBinding,
  type PeriodUnit,
} from "@shared/dashboards/types";
import type { SourceTable } from "@shared/domain/sources";
import { HttpError } from "./http";
import { cachedQuery, queryCacheKey } from "./query-cache";
import { assertReady, execute, getSourceRow } from "./sources/service";
import { assertReadOnlySql, quoteIdent, quoteQualified } from "./sources/sql";

type SourceRow = Awaited<ReturnType<typeof getSourceRow>>;

const AGGS: Record<Aggregation, string> = {
  sum: "sum",
  avg: "avg",
  count: "count",
  min: "min",
  max: "max",
};

const PERIOD_UNITS: PeriodUnit[] = ["day", "week", "month", "quarter", "year"];

const findTable = (tables: SourceTable[], name: string | undefined) => {
  const table = tables.find((entry) => entry.name === name);
  if (!table) throw new HttpError(400, `Tabela "${name ?? ""}" não existe nesta fonte.`);
  return table;
};

const assertColumn = (table: SourceTable, column: string | undefined, role: string) => {
  if (!column || !table.columns.some((entry) => entry.name === column)) {
    throw new HttpError(400, `Coluna de ${role} "${column ?? ""}" não existe em ${table.name}.`);
  }
  return column;
};

const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

/** Data ISO real (rejeita 2024-02-31). */
const assertDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, `Data inválida no filtro: ${value}.`);
  }
  return value;
};

const dateOf = (column: string) => `CAST(${quoteIdent(column)} AS DATE)`;

/** Condições (sem o WHERE) dos filtros que se aplicam a esta fonte e tabela. */
export const filterConditions = (sourceId: string, table: SourceTable, filters: ActiveFilter[]): string[] =>
  filters
    .filter((f) => f.value !== "")
    .filter((f) =>
      // filtro global: vale para qualquer tabela que tenha uma coluna com o mesmo nome
      f.byName ? table.columns.some((c) => c.name === f.column) : f.sourceId === sourceId && f.table === table.name,
    )
    .map((f) => {
      assertColumn(table, f.column, "filtro");
      if (f.value.length > FILTER_VALUE_MAX) throw new HttpError(400, "Valor de filtro longo demais.");
      if (f.range) {
        const range = parseRange(f.value);
        if (!range) throw new HttpError(400, "Intervalo de datas inválido.");
        const parts = [
          range.from ? `${dateOf(f.column)} >= DATE ${literal(assertDate(range.from))}` : "",
          range.to ? `${dateOf(f.column)} <= DATE ${literal(assertDate(range.to))}` : "",
        ].filter(Boolean);
        return parts.join(" AND ");
      }
      return `CAST(${quoteIdent(f.column)} AS VARCHAR) = ${literal(f.value)}`;
    });

const whereOf = (conditions: string[]) => (conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "");

/** Expressão da medida: coluna agregada ou medida calculada validada. */
const measureSql = (binding: DataBinding, table: SourceTable): string => {
  if (binding.calc) {
    const out = compileMeasure(
      binding.calc.expr,
      table.columns.map((c) => ({ name: c.name, kind: c.kind })),
      quoteIdent,
    );
    if (!out.ok) throw new HttpError(400, `Medida "${binding.calc.name}": ${out.error}`);
    return out.sql;
  }
  const agg = AGGS[binding.agg ?? "sum"];
  if (!agg) throw new HttpError(400, "Agregação inválida.");
  return agg === "count" && !binding.measure
    ? "count(*)"
    : `${agg}(${quoteIdent(assertColumn(table, binding.measure, "medida"))})`;
};

export const builderSql = (binding: DataBinding, tables: SourceTable[], filters: ActiveFilter[]) => {
  const table = findTable(tables, binding.table);
  const from = ` FROM ${quoteQualified(table.name)}${whereOf(filterConditions(binding.sourceId, table, filters))}`;
  const limit = Math.min(Math.max(Math.round(binding.limit ?? 50), 1), BINDING_LIMIT_MAX);

  // tabela "bruta": colunas escolhidas, sem agregação
  if (!binding.dimension && !binding.measure && binding.agg !== "count" && !binding.calc) {
    const columns = (binding.columns ?? []).filter(Boolean);
    columns.forEach((column) => assertColumn(table, column, "tabela"));
    const select = columns.length > 0 ? columns.map(quoteIdent).join(", ") : "*";
    return `SELECT ${select}${from} LIMIT ${limit}`;
  }

  const measure = measureSql(binding, table);

  if (!binding.dimension) return `SELECT ${measure} AS valor${from}`;

  const dimension = quoteIdent(assertColumn(table, binding.dimension, "agrupamento"));
  const split =
    binding.splitBy && binding.splitBy !== binding.dimension
      ? quoteIdent(assertColumn(table, binding.splitBy, "séries"))
      : null;
  const order =
    binding.sort === "valor_asc"
      ? "valor ASC"
      : binding.sort === "label_asc"
        ? "label ASC"
        : binding.sort === "label_desc"
          ? "label DESC"
          : "valor DESC";
  if (split) {
    return `SELECT ${dimension} AS label, ${split} AS serie, ${measure} AS valor${from} GROUP BY 1, 2 ORDER BY ${order} NULLS LAST LIMIT ${BINDING_LIMIT_MAX}`;
  }
  return `SELECT ${dimension} AS label, ${measure} AS valor${from} GROUP BY 1 ORDER BY ${order} NULLS LAST LIMIT ${limit}`;
};

/* ----------------------------------------------------- comparação de períodos */

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Início do período `steps` unidades depois (ou antes, se negativo) de `start`. */
const shiftPeriod = (start: Date, unit: PeriodUnit, steps: number): Date => {
  const d = new Date(start.getTime());
  if (unit === "day") d.setUTCDate(d.getUTCDate() + steps);
  else if (unit === "week") d.setUTCDate(d.getUTCDate() + 7 * steps);
  else if (unit === "month") d.setUTCMonth(d.getUTCMonth() + steps);
  else if (unit === "quarter") d.setUTCMonth(d.getUTCMonth() + 3 * steps);
  else d.setUTCFullYear(d.getUTCFullYear() + steps);
  return d;
};

const labelPeriod = (start: Date, unit: PeriodUnit): string => {
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth() + 1;
  switch (unit) {
    case "day":
      return `${pad(start.getUTCDate())}/${pad(m)}/${y}`;
    case "week":
      return `semana de ${pad(start.getUTCDate())}/${pad(m)}`;
    case "month":
      return `${pad(m)}/${y}`;
    case "quarter":
      return `T${Math.floor((m - 1) / 3) + 1}/${y}`;
    case "year":
      return String(y);
  }
};

const toNumber = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Indicador comparado: o último período dos dados contra o período anterior. */
const runCompare = async (
  source: SourceRow,
  binding: DataBinding,
  filters: ActiveFilter[],
  fresh: boolean,
): Promise<BindingData> => {
  const compare = binding.compare!;
  if (!PERIOD_UNITS.includes(compare.unit)) throw new HttpError(400, "Unidade de período inválida.");
  const table = findTable(source.tables, binding.table);
  assertColumn(table, compare.dateColumn, "data");
  const conditions = filterConditions(binding.sourceId, table, filters);
  const col = dateOf(compare.dateColumn);
  const tableSql = quoteQualified(table.name);

  const bounds = await cachedExecute(
    source,
    `SELECT CAST(CAST(date_trunc('${compare.unit}', max(${col})) AS DATE) AS VARCHAR) AS atual FROM ${tableSql}${whereOf(conditions)}`,
    undefined,
    fresh,
  );
  const atual = String(bounds.rows[0]?.atual ?? "");
  if (!/^\d{4}-\d{2}-\d{2}/.test(atual)) {
    return { columns: bounds.columns, rows: [], truncated: false, durationMs: bounds.durationMs };
  }
  const currentStart = new Date(`${atual.slice(0, 10)}T00:00:00Z`);
  const nextStart = shiftPeriod(currentStart, compare.unit, 1);
  const previousStart = shiftPeriod(currentStart, compare.unit, -1);
  const measure = measureSql(binding, table);

  const window = (from: Date, to: Date) =>
    `SELECT ${measure} AS valor FROM ${tableSql}${whereOf([
      ...conditions,
      `${col} >= DATE '${iso(from)}'`,
      `${col} < DATE '${iso(to)}'`,
    ])}`;

  const [current, previous] = await Promise.all([
    cachedExecute(source, window(currentStart, nextStart), undefined, fresh),
    cachedExecute(source, window(previousStart, currentStart), undefined, fresh),
  ]);
  return {
    columns: current.columns,
    rows: current.rows,
    truncated: false,
    durationMs: current.durationMs + previous.durationMs,
    compare: {
      previous: toNumber(previous.rows[0]?.valor),
      unit: compare.unit,
      currentLabel: labelPeriod(currentStart, compare.unit),
      previousLabel: labelPeriod(previousStart, compare.unit),
    },
  };
};

/* ------------------------------------------------------------------ execução */

const cachedExecute = (source: SourceRow, sql: string, limit: number | undefined, fresh: boolean) =>
  cachedQuery(queryCacheKey(source.id, source.updatedAt.getTime(), limit, sql), () => execute(source, sql, limit), {
    fresh,
  });

/** Executa a ligação de um elemento na fonte do dono do painel. */
export const runBinding = async (
  ownerId: string,
  binding: DataBinding,
  filters: ActiveFilter[] = [],
  options: { fresh?: boolean } = {},
): Promise<BindingData> => {
  if (binding.mode !== "builder" && binding.mode !== "sql") {
    throw new HttpError(400, "Ligação de dados inválida.");
  }
  const fresh = Boolean(options.fresh);
  const source = await getSourceRow(ownerId, binding.sourceId);
  assertReady(source);

  if (binding.mode === "builder" && binding.compare && !binding.dimension) {
    return runCompare(source, binding, filters, fresh);
  }

  const sql =
    binding.mode === "sql"
      ? assertReadOnlySql(binding.sql ?? "")
      : builderSql(binding, source.tables, filters);
  const out = await cachedExecute(source, sql, BINDING_LIMIT_MAX, fresh);
  return { columns: out.columns, rows: out.rows, truncated: out.truncated, durationMs: out.durationMs };
};

/** Valores distintos de uma coluna (opções do elemento de filtro). */
export const filterOptions = async (ownerId: string, binding: FilterBinding): Promise<FilterOptions> => {
  const source = await getSourceRow(ownerId, binding.sourceId);
  assertReady(source);
  const table = findTable(source.tables, binding.table);
  const column = quoteIdent(assertColumn(table, binding.column, "filtro"));
  const out = await cachedExecute(
    source,
    `SELECT DISTINCT CAST(${column} AS VARCHAR) AS v FROM ${quoteQualified(table.name)} WHERE ${column} IS NOT NULL ORDER BY 1`,
    FILTER_OPTIONS_LIMIT,
    false,
  );
  return { options: out.rows.map((row) => String(row.v)) };
};
