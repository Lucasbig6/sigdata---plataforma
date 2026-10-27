/**
 * Dados ao vivo dos elementos de dashboard.
 *
 * Modo "builder": o SQL é montado aqui a partir de nomes validados contra o
 * schema cacheado da fonte (nunca texto livre do cliente) e os filtros entram
 * como literais escapados. Modo "sql": a consulta do autor passa pela mesma
 * barreira de somente-leitura do chat.
 */
import type {
  ActiveFilter,
  BindingData,
  FilterOptions,
} from "@shared/dashboards/data";
import { FILTER_OPTIONS_LIMIT, FILTER_VALUE_MAX } from "@shared/dashboards/data";
import {
  BINDING_LIMIT_MAX,
  type Aggregation,
  type DataBinding,
  type FilterBinding,
} from "@shared/dashboards/types";
import type { SourceTable } from "@shared/domain/sources";
import { HttpError } from "./http";
import { assertReady, execute, getSourceRow } from "./sources/service";
import { assertReadOnlySql, quoteIdent, quoteQualified } from "./sources/sql";

const AGGS: Record<Aggregation, string> = {
  sum: "sum",
  avg: "avg",
  count: "count",
  min: "min",
  max: "max",
};

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

/** WHERE com os filtros que se aplicam a esta fonte e tabela. */
const whereClause = (sourceId: string, table: SourceTable, filters: ActiveFilter[]) => {
  const parts = filters
    .filter((f) => f.sourceId === sourceId && f.table === table.name && f.value !== "")
    .map((f) => {
      assertColumn(table, f.column, "filtro");
      if (f.value.length > FILTER_VALUE_MAX) throw new HttpError(400, "Valor de filtro longo demais.");
      return `CAST(${quoteIdent(f.column)} AS VARCHAR) = ${literal(f.value)}`;
    });
  return parts.length > 0 ? ` WHERE ${parts.join(" AND ")}` : "";
};

const builderSql = (binding: DataBinding, tables: SourceTable[], filters: ActiveFilter[]) => {
  const table = findTable(tables, binding.table);
  const from = ` FROM ${quoteQualified(table.name)}${whereClause(binding.sourceId, table, filters)}`;
  const limit = Math.min(Math.max(Math.round(binding.limit ?? 50), 1), BINDING_LIMIT_MAX);

  // tabela "bruta": colunas escolhidas, sem agregação
  if (!binding.dimension && !binding.measure && binding.agg !== "count") {
    const columns = (binding.columns ?? []).filter(Boolean);
    columns.forEach((column) => assertColumn(table, column, "tabela"));
    const select = columns.length > 0 ? columns.map(quoteIdent).join(", ") : "*";
    return `SELECT ${select}${from} LIMIT ${limit}`;
  }

  const agg = AGGS[binding.agg ?? "sum"];
  if (!agg) throw new HttpError(400, "Agregação inválida.");
  const measure =
    agg === "count" && !binding.measure
      ? "count(*)"
      : `${agg}(${quoteIdent(assertColumn(table, binding.measure, "medida"))})`;

  if (!binding.dimension) return `SELECT ${measure} AS valor${from}`;

  const dimension = quoteIdent(assertColumn(table, binding.dimension, "agrupamento"));
  const order =
    binding.sort === "valor_asc"
      ? "valor ASC"
      : binding.sort === "label_asc"
        ? "label ASC"
        : binding.sort === "label_desc"
          ? "label DESC"
          : "valor DESC";
  return `SELECT ${dimension} AS label, ${measure} AS valor${from} GROUP BY 1 ORDER BY ${order} NULLS LAST LIMIT ${limit}`;
};

/** Executa a ligação de um elemento na fonte do dono do painel. */
export const runBinding = async (
  ownerId: string,
  binding: DataBinding,
  filters: ActiveFilter[] = [],
): Promise<BindingData> => {
  if (binding.mode !== "builder" && binding.mode !== "sql") {
    throw new HttpError(400, "Ligação de dados inválida.");
  }
  const source = await getSourceRow(ownerId, binding.sourceId);
  assertReady(source);
  const sql =
    binding.mode === "sql"
      ? assertReadOnlySql(binding.sql ?? "")
      : builderSql(binding, source.tables, filters);
  const out = await execute(source, sql, BINDING_LIMIT_MAX);
  return { columns: out.columns, rows: out.rows, truncated: out.truncated, durationMs: out.durationMs };
};

/** Valores distintos de uma coluna (opções do elemento de filtro). */
export const filterOptions = async (ownerId: string, binding: FilterBinding): Promise<FilterOptions> => {
  const source = await getSourceRow(ownerId, binding.sourceId);
  assertReady(source);
  const table = findTable(source.tables, binding.table);
  const column = quoteIdent(assertColumn(table, binding.column, "filtro"));
  const out = await execute(
    source,
    `SELECT DISTINCT CAST(${column} AS VARCHAR) AS v FROM ${quoteQualified(table.name)} WHERE ${column} IS NOT NULL ORDER BY 1`,
    FILTER_OPTIONS_LIMIT,
  );
  return { options: out.rows.map((row) => String(row.v)) };
};
