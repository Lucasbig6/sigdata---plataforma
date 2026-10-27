/** Widgets do painel analítico do workspace (persistidos por projeto). */
import type { Kpi, Municipio, SeriesPoint } from "./demo-data";

export type WidgetKind = "linha" | "barras" | "kpi" | "tabela";

/** Tabela genérica (colunas vindas de um resultado de consulta). */
export type GenericTable = {
  columns: string[];
  rows: Record<string, unknown>[];
};

export type PanelWidget = {
  id: string;
  kind: WidgetKind;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  /** Resultado de consulta que originou o widget. */
  resultId?: string;
  series?: SeriesPoint[];
  kpis?: Kpi[];
  rows?: Municipio[];
  table?: GenericTable;
};

export type WidgetData = Pick<PanelWidget, "resultId" | "series" | "kpis" | "rows" | "table">;

export const MAX_WIDGETS_PER_NOTEBOOK = 40;
