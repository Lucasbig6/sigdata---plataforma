/**
 * Modelo de dados do editor de dashboards SIGDATA.
 *
 * SISTEMA DE COORDENADAS
 * ----------------------
 * Cada dashboard tem um canvas lógico fixo (ver CANVAS). As posições (x, y)
 * e tamanhos (w, h) dos elementos são armazenados em unidades lógicas desse
 * canvas, com origem no canto superior esquerdo, crescente para a direita e
 * para baixo.
 *
 * O zoom é apenas uma transformação de exibição (`transform: scale`) aplicada
 * na renderização: os valores salvos nunca são multiplicados pela escala da
 * janela, então o layout restaura idêntico em qualquer resolução.
 *
 * Camadas: `z` maior fica por cima. A ordem é re-normalizada para 0..n-1 a
 * cada reordenação. Sobreposição entre elementos é livre e controlada só por
 * `z` e `hidden`.
 */

export const DASHBOARD_SCHEMA_VERSION = 1;

export const CANVAS = { width: 1600, height: 1000 } as const;

export const CANVAS_LIMITS = { min: { w: 480, h: 320 }, max: { w: 4000, h: 6000 } } as const;

/** Tamanhos de página prontos (px lógicos; A4/Carta a 96 dpi). */
export const PAGE_PRESETS = [
  { id: "padrao", label: "Painel (1600 × 1000)", width: 1600, height: 1000 },
  { id: "widescreen", label: "Widescreen 16:9 (1600 × 900)", width: 1600, height: 900 },
  { id: "fullhd", label: "Full HD (1920 × 1080)", width: 1920, height: 1080 },
  { id: "a4-paisagem", label: "A4 paisagem (1123 × 794)", width: 1123, height: 794 },
  { id: "a4-retrato", label: "A4 retrato (794 × 1123)", width: 794, height: 1123 },
  { id: "carta-paisagem", label: "Carta paisagem (1056 × 816)", width: 1056, height: 816 },
  { id: "longo", label: "Rolagem longa (1440 × 2400)", width: 1440, height: 2400 },
] as const;

/** Tamanho inicial dos elementos ao serem inseridos. */
export const ELEMENT_SIZES = {
  chart: { w: 520, h: 320 },
  table: { w: 560, h: 300 },
  kpi: { w: 240, h: 132 },
  percent: { w: 240, h: 132 },
  comparison: { w: 300, h: 132 },
  text: { w: 420, h: 96 },
  title: { w: 460, h: 72 },
  image: { w: 360, h: 220 },
  divider: { w: 480, h: 24 },
  shape: { w: 240, h: 160 },
  filter: { w: 260, h: 92 },
} as const;

/** Limites mínimos de redimensionamento por tipo. */
export const ELEMENT_MIN = {
  chart: { w: 240, h: 180 },
  table: { w: 320, h: 160 },
  kpi: { w: 160, h: 96 },
  percent: { w: 160, h: 96 },
  comparison: { w: 200, h: 96 },
  text: { w: 160, h: 48 },
  title: { w: 200, h: 44 },
  image: { w: 160, h: 120 },
  divider: { w: 120, h: 8 },
  shape: { w: 80, h: 60 },
  filter: { w: 200, h: 76 },
} as const;

export type ElementType =
  | "chart"
  | "table"
  | "kpi"
  | "percent"
  | "comparison"
  | "text"
  | "title"
  | "image"
  | "divider"
  | "shape"
  | "filter";

export type ChartType = "bar" | "line" | "area" | "pie";

export type ChartColor = 1 | 2 | 3 | 4 | 5;

/**
 * Formato comum de visualização: usado tanto pelos dados fictícios do
 * projeto quanto por análises salvas na conversa (futuro backend troca
 * apenas a implementação de `resolveSeries`).
 */
export type DatasetRef = {
  source: "demo" | "analysis";
  ref: string;
  categoryField: "periodo" | "municipio";
  valueField: "valor" | "indice" | "receita" | "variacao" | "delta";
};

/* ------------------------------------------------------- dados ao vivo */

export type Aggregation = "sum" | "avg" | "count" | "min" | "max";

export type BindingSort = "valor_desc" | "valor_asc" | "label_asc" | "label_desc";

/**
 * Ligação de um elemento a uma fonte de dados real, consultada no backend a
 * cada exibição. No modo "builder" o backend monta o SQL (e aplica filtros);
 * no modo "sql" executa a consulta escrita pelo autor.
 *
 * Resultado do builder: colunas `label` (dimensão) e `valor` (medida); sem
 * dimensão, uma única linha com `valor`. Tabela sem dimensão: colunas brutas.
 */
export type DataBinding = {
  sourceId: string;
  mode: "builder" | "sql";
  table?: string;
  dimension?: string;
  measure?: string;
  agg?: Aggregation;
  sort?: BindingSort;
  limit?: number;
  /** Colunas exibidas em tabela sem agrupamento (vazio = todas). */
  columns?: string[];
  sql?: string;
  /** Mapeamento no modo SQL. */
  x?: string;
  y?: string;
};

/** Coluna que um elemento de filtro controla. */
export type FilterBinding = {
  sourceId: string;
  table: string;
  column: string;
};

export type NumberFormat = "numero" | "moeda" | "percentual" | "compacto";

export const BINDING_LIMIT_MAX = 500;

export type ChartProps = {
  chartType: ChartType;
  title: string;
  showTitle: boolean;
  subtitle: string;
  dataset: DatasetRef;
  binding?: DataBinding;
  color: ChartColor;
  showGrid: boolean;
  showLegend: boolean;
};

export type TableProps = {
  title: string;
  showTitle: boolean;
  dataset: DatasetRef;
  binding?: DataBinding;
  density: "compacta" | "confortavel";
};

export type IndicatorProps = {
  title: string;
  value: string;
  description: string;
  unit: string;
  delta: number;
  showDelta: boolean;
  binding?: DataBinding;
  format?: NumberFormat;
  decimals?: number;
};

export type TextProps = {
  content: string;
  fontSize: number;
  bold: boolean;
  align: "left" | "center" | "right";
  color: string;
};

export type ImageProps = {
  alt: string;
  variant: "gradiente" | "malha" | "ondas";
  accent: ChartColor;
  fit: "cover" | "contain";
  /** URL de uma imagem (https). Sem URL, mostra a ilustração gerada. */
  src?: string;
};

export type DividerProps = {
  thickness: number;
  color: string;
  style: "solid" | "dashed";
};

export type ShapeProps = {
  shape: "retangulo" | "circulo";
  fill: string;
  border: string;
  borderWidth: number;
  radius: number;
};

export type FilterKind = "periodo" | "categoria" | "municipio";

export type FilterProps = {
  label: string;
  kind: FilterKind;
  options: string[];
  /** Valor padrão ("" = todos). */
  value: string;
  binding?: FilterBinding;
};

type ElementBase = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  hidden: boolean;
};

export type DashboardElement =
  | (ElementBase & { type: "chart"; props: ChartProps })
  | (ElementBase & { type: "table"; props: TableProps })
  | (ElementBase & {
      type: "kpi" | "percent" | "comparison";
      props: IndicatorProps;
    })
  | (ElementBase & { type: "text" | "title"; props: TextProps })
  | (ElementBase & { type: "image"; props: ImageProps })
  | (ElementBase & { type: "divider"; props: DividerProps })
  | (ElementBase & { type: "shape"; props: ShapeProps })
  | (ElementBase & { type: "filter"; props: FilterProps });

export type Dashboard = {
  id: string;
  schemaVersion: number;
  name: string;
  description: string;
  origin: "demo" | "user";
  createdAt: number;
  updatedAt: number;
  canvas: { width: number; height: number };
  elements: DashboardElement[];
};

export const isChart = (
  el: DashboardElement,
): el is DashboardElement & {
  type: "chart";
  props: ChartProps;
} => el.type === "chart";

export const isIndicator = (
  el: DashboardElement,
): el is DashboardElement & {
  type: "kpi" | "percent" | "comparison";
  props: IndicatorProps;
} => el.type === "kpi" || el.type === "percent" || el.type === "comparison";

export const isText = (
  el: DashboardElement,
): el is DashboardElement & { type: "text" | "title"; props: TextProps } =>
  el.type === "text" || el.type === "title";

let idCounter = 0;

export const uid = (prefix = "el"): string => {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : `${Date.now().toString(36)}${(idCounter++).toString(36)}`;
  return `${prefix}-${rand}`;
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(value)));

/** Impede que o elemento seja arrastado para fora da área útil do canvas. */
export const clampPosition = (
  el: Pick<DashboardElement, "x" | "y" | "w" | "h">,
  canvas: { width: number; height: number } = CANVAS,
): { x: number; y: number } => ({
  x: clamp(el.x, 0, Math.max(0, canvas.width - el.w)),
  y: clamp(el.y, 0, Math.max(0, canvas.height - el.h)),
});

/** Impede que o elemento fique com tamanho inválido ao redimensionar. */
export const clampSize = (
  el: Pick<DashboardElement, "w" | "h">,
  type: ElementType,
  canvas: { width: number; height: number } = CANVAS,
): { w: number; h: number } => {
  const min = ELEMENT_MIN[type];
  return {
    w: clamp(el.w, min.w, canvas.width),
    h: clamp(el.h, min.h, canvas.height),
  };
};

/** Reordena as camadas para 0..n-1 preservando a pilha atual. */
export const reindexLayers = (elements: DashboardElement[]): DashboardElement[] =>
  [...elements]
    .sort((a, b) => a.z - b.z)
    .map((el, index) => (el.z === index ? el : { ...el, z: index }));

export const topLevelZ = (elements: DashboardElement[]): number =>
  elements.reduce((max, el) => Math.max(max, el.z), 0) + 1;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const ELEMENT_TYPES: ElementType[] = [
  "chart",
  "table",
  "kpi",
  "percent",
  "comparison",
  "text",
  "title",
  "image",
  "divider",
  "shape",
  "filter",
];

const sanitizeElement = (raw: unknown): DashboardElement | null => {
  if (!isRecord(raw)) return null;
  const { id, type, x, y, w, h, z, hidden, props } = raw;
  if (typeof id !== "string" || !ELEMENT_TYPES.includes(type as ElementType)) return null;
  if (![x, y, w, h, z].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  if (!isRecord(props)) return null;
  return {
    id,
    type: type as ElementType,
    x,
    y,
    w,
    h,
    z,
    hidden: hidden === true,
    props,
  } as DashboardElement;
};

/**
 * Valida dados lidos do localStorage (entradas inválidas ou de versões
 * antigas retornam null e são ignoradas com segurança).
 */
export const migrateDashboard = (raw: unknown): Dashboard | null => {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  if (typeof raw.schemaVersion !== "number") return null;
  if (raw.schemaVersion > DASHBOARD_SCHEMA_VERSION) return null;
  if (!Array.isArray(raw.elements)) return null;

  const elements = raw.elements
    .map(sanitizeElement)
    .filter((el): el is DashboardElement => el !== null);

  const canvas = isRecord(raw.canvas)
    ? {
        width: typeof raw.canvas.width === "number" ? raw.canvas.width : CANVAS.width,
        height: typeof raw.canvas.height === "number" ? raw.canvas.height : CANVAS.height,
      }
    : { ...CANVAS };

  return {
    id: raw.id,
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    name: raw.name,
    description: typeof raw.description === "string" ? raw.description : "",
    origin: raw.origin === "demo" ? "demo" : "user",
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
    canvas,
    elements: reindexLayers(elements.map((el) => ({ ...el, ...clampPosition(el, canvas) }))),
  };
};
