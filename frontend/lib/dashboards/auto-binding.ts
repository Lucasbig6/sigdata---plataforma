/**
 * Ligação inicial de elementos novos: escolhe uma fonte, tabela e colunas
 * plausíveis para que o elemento já nasça mostrando dados reais.
 */
import type { DataSource, SourceTable } from "@/lib/domain/sources";
import type { Aggregation, DataBinding, ElementType } from "@/lib/dashboards/types";

export const AGG_LABELS: Record<Aggregation, string> = {
  sum: "Soma",
  avg: "Média",
  count: "Contagem",
  min: "Mínimo",
  max: "Máximo",
};

const pickTable = (source: DataSource): SourceTable | undefined =>
  source.tables.find((t) => t.columns.some((c) => c.kind === "numero")) ?? source.tables[0];

/** Fonte padrão: a mais recente pronta (fontes do usuário antes da demonstração). */
export const defaultSource = (sources: DataSource[]) => {
  const ready = sources.filter((s) => s.status === "pronta" && s.tables.length > 0);
  return ready.find((s) => s.kind !== "demo") ?? ready[0];
};

/** Monta um binding de construtor razoável para a tabela escolhida. */
export const builderFor = (
  type: ElementType,
  sourceId: string,
  table: SourceTable,
): DataBinding => {
  const measure = table.columns.find((c) => c.kind === "numero")?.name;
  const dimension =
    table.columns.find((c) => c.kind === "texto")?.name ??
    table.columns.find((c) => c.kind === "data")?.name;
  const agg: Aggregation = measure ? "sum" : "count";
  const base = { sourceId, mode: "builder" as const, table: table.name };

  if (type === "table") return { ...base, columns: [], limit: 100 };
  if (type === "kpi" || type === "percent" || type === "comparison") return { ...base, measure, agg };
  return {
    ...base,
    dimension,
    measure,
    agg,
    sort: table.columns.find((c) => c.name === dimension)?.kind === "data" ? "label_asc" : "valor_desc",
    limit: 20,
  };
};

export const describeBinding = (binding: DataBinding) => {
  if (binding.mode === "sql") return "Consulta SQL";
  const agg = AGG_LABELS[binding.agg ?? "sum"];
  const measure = binding.measure ? `${agg} de ${binding.measure}` : agg;
  return binding.dimension ? `${measure} por ${binding.dimension}` : measure;
};

/** Props iniciais (ligação + título) para um item novo da biblioteca. */
export const autoProps = (
  type: ElementType,
  sources: DataSource[],
): Record<string, unknown> | undefined => {
  const source = defaultSource(sources);
  const table = source ? pickTable(source) : undefined;
  if (!source || !table) return undefined;

  if (type === "filter") {
    const column = table.columns.find((c) => c.kind === "texto") ?? table.columns[0];
    if (!column) return undefined;
    return {
      label: column.name,
      binding: { sourceId: source.id, table: table.name, column: column.name },
      options: [],
      value: "",
    };
  }

  if (type !== "chart" && type !== "table" && type !== "kpi" && type !== "percent" && type !== "comparison") {
    return undefined;
  }

  const binding = builderFor(type, source.id, table);
  if (type === "table") return { binding, title: table.name };
  return { binding, title: describeBinding(binding), ...(type !== "chart" && { description: source.name }) };
};
