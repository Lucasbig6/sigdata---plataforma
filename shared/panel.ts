/** Widgets do painel analítico do workspace (persistidos por projeto). */
import type { ChartData, ChartType } from "./charts/types";
import type { Kpi, Municipio, SeriesPoint } from "./demo-data";

export type WidgetKind =
  | "linha"
  | "barras"
  | "barras_h"
  | "area"
  | "combo"
  | "pizza"
  | "rosca"
  | "dispersao"
  | "radar"
  | "funil"
  | "medidor"
  | "treemap"
  | "calor"
  | "kpi"
  | "tabela";

export const WIDGET_KINDS: WidgetKind[] = [
  "linha",
  "barras",
  "barras_h",
  "area",
  "combo",
  "pizza",
  "rosca",
  "dispersao",
  "radar",
  "funil",
  "medidor",
  "treemap",
  "calor",
  "kpi",
  "tabela",
];

/** Tipo de gráfico de cada visualização; indicadores e tabelas não têm. */
export const WIDGET_CHART_TYPE: Partial<Record<WidgetKind, ChartType>> = {
  linha: "line",
  barras: "bar",
  barras_h: "hbar",
  area: "area",
  combo: "combo",
  pizza: "pie",
  rosca: "donut",
  dispersao: "scatter",
  radar: "radar",
  funil: "funnel",
  medidor: "gauge",
  treemap: "treemap",
  calor: "heatmap",
};

export const isChartKind = (kind: WidgetKind): boolean => kind in WIDGET_CHART_TYPE;

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
  /** Colunas do resultado usadas como categoria e valor (editáveis pelo usuário e pelo agente). */
  xCol?: string;
  yCol?: string;
  /** Colunas Y extras (várias séries) ou coluna que divide as séries. */
  ysCols?: string[];
  splitBy?: string;
  /** Dados dos gráficos (várias séries). `series` é o formato antigo, de uma série. */
  chart?: ChartData;
  series?: SeriesPoint[];
  kpis?: Kpi[];
  rows?: Municipio[];
  table?: GenericTable;
  /** Configuração de borda do gráfico. */
  border?: { width?: number; color?: string; style?: "solid" | "dashed" | "dotted" };
};

export type WidgetData = Pick<PanelWidget, "resultId" | "xCol" | "yCol" | "ysCols" | "splitBy" | "chart" | "series" | "kpis" | "rows" | "table" | "border">;

export const MAX_WIDGETS_PER_NOTEBOOK = 40;
