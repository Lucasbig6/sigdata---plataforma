/**
 * Modelo de gráficos compartilhado entre o editor de dashboards e o chat.
 * `ChartStyle` descreve só a aparência; todos os campos são opcionais para que
 * dashboards salvos antes continuem abrindo igual.
 */

export type ChartType =
  | "bar"
  | "hbar"
  | "line"
  | "area"
  | "combo"
  | "pie"
  | "donut"
  | "scatter"
  | "radar"
  | "funnel"
  | "gauge"
  | "treemap"
  | "heatmap";

export const CHART_TYPES: ChartType[] = [
  "bar",
  "hbar",
  "line",
  "area",
  "combo",
  "pie",
  "donut",
  "scatter",
  "radar",
  "funnel",
  "gauge",
  "treemap",
  "heatmap",
];

export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: "Barras",
  hbar: "Barras horizontais",
  line: "Linhas",
  area: "Área",
  combo: "Combinado (barras + linhas)",
  pie: "Pizza",
  donut: "Rosca",
  scatter: "Dispersão",
  radar: "Radar",
  funnel: "Funil",
  gauge: "Medidor",
  treemap: "Treemap",
  heatmap: "Mapa de calor",
};

export type NumberFormat = "numero" | "moeda" | "percentual" | "compacto";

export type LegendPosition = "auto" | "none" | "top" | "bottom" | "left" | "right";

export type ChartStyle = {
  /** Empilhamento de barras/áreas/linhas (percent = 100%). */
  stack?: "none" | "stack" | "percent";
  smooth?: boolean;
  showPoints?: boolean;
  lineWidth?: number;
  border?: {
    /** Largura da borda em pixels */
    width?: number;
    /** Cor da borda em hex */
    color?: string;
    /** Estilo da borda: solid, dashed, dotted */
    style?: "solid" | "dashed" | "dotted";
  };
  /** 0–1, só áreas. */
  areaOpacity?: number;
  barRadius?: number;
  showLabels?: boolean;
  legend?: LegendPosition;
  showTooltip?: boolean;
  /** Cores das séries (hex); vazio = paleta do tema. */
  palette?: string[];
  xTitle?: string;
  yTitle?: string;
  yMin?: number;
  yMax?: number;
  hideXAxis?: boolean;
  hideYAxis?: boolean;
  rotateLabels?: number;
  /** Barra de zoom/rolagem no eixo X. */
  zoom?: boolean;
  refLine?: number;
  refLabel?: string;
  valueFormat?: NumberFormat;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Rosca: tamanho do furo (% do raio). */
  innerRadius?: number;
  gaugeMax?: number;
  /** JSON com opções do ECharts mescladas por cima (personalização sem limite). */
  advanced?: string;
};

/** Dados prontos para desenhar: categorias no eixo X e uma ou mais séries. */
export type ChartData = {
  categories: string[];
  series: { name: string; values: (number | null)[] }[];
};
