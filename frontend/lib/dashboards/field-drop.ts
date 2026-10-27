/**
 * Soltar um campo (coluna) da aba Dados sobre um elemento: ajusta a ligação de
 * dados do gráfico, tabela ou indicador em vez de criar outro elemento.
 */
import { builderFor, describeBinding } from "@/lib/dashboards/auto-binding";
import type { DashboardElement, DataBinding } from "@/lib/dashboards/types";
import type { ColumnKind, DataSource } from "@/lib/domain/sources";

/** MIME do drag de uma coluna para o canvas. */
export const FIELD_MIME = "application/x-sigdata-field";

export type DraggedField = { sourceId: string; table: string; column: string; kind: ColumnKind };

const isIndicator = (type: DashboardElement["type"]) => type === "kpi" || type === "percent" || type === "comparison";

export const canReceiveField = (element: DashboardElement) =>
  element.type === "chart" || element.type === "table" || isIndicator(element.type);

/**
 * Props novas do elemento após receber o campo; `null` quando o campo não faz
 * sentido ali. Com `replace`, um campo de categoria troca o eixo X em vez de
 * virar "dividir por".
 */
export const applyFieldToElement = (
  element: DashboardElement,
  field: DraggedField,
  sources: DataSource[],
  replace: boolean,
): Record<string, unknown> | null => {
  if (!canReceiveField(element)) return null;
  const source = sources.find((entry) => entry.id === field.sourceId);
  const table = source?.tables.find((entry) => entry.name === field.table);
  if (!source || !table) return null;

  const props = element.props as { binding?: DataBinding; title?: string };
  const current = props.binding;
  const sameTable = current?.mode === "builder" && current.sourceId === field.sourceId && current.table === field.table;
  const base: DataBinding = sameTable && current ? current : builderFor(element.type, source.id, table);
  const numeric = field.kind === "numero";
  let next: DataBinding = { ...base };

  if (element.type === "table") {
    if (next.dimension) {
      next = numeric
        ? { ...next, measure: field.column, agg: next.agg === "count" || !next.agg ? "sum" : next.agg }
        : { ...next, dimension: field.column };
    } else {
      const columns = next.columns ?? [];
      next = { ...next, columns: columns.includes(field.column) ? columns : [...columns, field.column] };
    }
  } else if (isIndicator(element.type)) {
    if (!numeric) return null;
    next = { ...next, measure: field.column, agg: next.agg && next.agg !== "count" ? next.agg : "sum" };
  } else if (numeric) {
    next = { ...next, measure: field.column, agg: next.agg && next.agg !== "count" ? next.agg : "sum" };
  } else if (!next.dimension || replace || next.dimension === field.column) {
    next = { ...next, dimension: field.column, splitBy: next.splitBy === field.column ? undefined : next.splitBy };
  } else {
    next = { ...next, splitBy: field.column };
  }

  const patch: Record<string, unknown> = { binding: next };
  // título automático acompanha a mudança; títulos escritos pelo usuário ficam
  const previousAuto = current ? describeBinding(current) : "";
  if (element.type !== "table" && (!props.title || props.title === previousAuto)) {
    patch.title = describeBinding(next);
  }
  return patch;
};

/** Elemento mais alto (maior z) que contém o ponto, em coordenadas da página. */
export const elementAt = (elements: DashboardElement[], x: number, y: number): DashboardElement | null => {
  const hit = [...elements]
    .filter((el) => !el.hidden && x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h)
    .sort((a, b) => b.z - a.z);
  return hit[0] ?? null;
};
