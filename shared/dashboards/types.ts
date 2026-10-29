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

import type { ChartStyle, ChartType, NumberFormat } from "../charts/types";

export type { ChartType, NumberFormat };

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
  { id: "hd", label: "HD 16:9 (1280 × 720)", width: 1280, height: 720 },
  { id: "4k", label: "4K 16:9 (3840 × 2160)", width: 3840, height: 2160 },
  { id: "quatro-tres", label: "Apresentação 4:3 (1440 × 1080)", width: 1440, height: 1080 },
  { id: "longo", label: "Rolagem longa (1440 × 2400)", width: 1440, height: 2400 },
] as const;

/** Cor de fundo da página: só hexadecimal de 6 dígitos (vai direto para o CSS). */
export const isPageBackground = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);

export const isPagePalette = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.length <= 12 && value.every(isPageBackground);

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
  /** Séries extras no modo SQL: colunas numéricas adicionais (além de `y`). */
  ys?: string[];
  /** Divide em uma série por valor desta coluna (builder: agrupa por dimensão + esta coluna). */
  splitBy?: string;
  /** Medida calculada (expressão segura, ver expr.ts); substitui `measure` e `agg`. */
  calc?: CalcMeasure;
  /** Indicador: compara o último período dos dados com o anterior. */
  compare?: PeriodCompare;
};

export type CalcMeasure = { name: string; expr: string };

export type PeriodUnit = "day" | "week" | "month" | "quarter" | "year";

export const PERIOD_UNIT_LABELS: Record<PeriodUnit, string> = {
  day: "dia",
  week: "semana",
  month: "mês",
  quarter: "trimestre",
  year: "ano",
};

export type PeriodCompare = { dateColumn: string; unit: PeriodUnit };

/** Medida reutilizável do painel (aparece como opção ao configurar um elemento). */
export type DashboardMeasure = { id: string; name: string; sourceId: string; table: string; expr: string };

/** Coluna que um elemento de filtro controla. */
export type FilterBinding = {
  sourceId: string;
  table: string;
  column: string;
};

export const BINDING_LIMIT_MAX = 500;

/**
 * Moldura de um elemento de dados (gráfico, tabela, indicador): borda, cantos,
 * fundo, espaçamento e sombra. Tudo opcional; ausente = moldura padrão do tema
 * (borda visível), então dashboards antigos também ganham o contorno.
 */
export type FrameStyle = {
  /** false = sem moldura (sem borda, fundo nem sombra). */
  enabled?: boolean;
  borderWidth?: number;
  /** Hexadecimal; ausente = cor de contorno do tema. */
  borderColor?: string;
  borderStyle?: "solid" | "dashed" | "dotted" | "double";
  radius?: number;
  /** Hexadecimal ou "transparent"; ausente = fundo de cartão do tema. */
  background?: string;
  /** Espaço interno em px; ausente = padrão do tipo de elemento. */
  padding?: number;
  shadow?: "none" | "sm" | "md" | "lg";
};

export const FRAME_LIMITS = { borderWidth: { min: 0, max: 12 }, radius: { min: 0, max: 48 }, padding: { min: 0, max: 48 } } as const;

export type ChartProps = ChartStyle & {
  /** Moldura (borda, fundo, cantos, sombra). */
  frame?: FrameStyle;
  /** Clicar numa categoria filtra os outros elementos (padrão: sim). */
  crossFilter?: boolean;
  /** Não aplica os filtros do painel a este elemento. */
  ignoreFilters?: boolean;
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
  frame?: FrameStyle;
  ignoreFilters?: boolean;
  title: string;
  showTitle: boolean;
  dataset: DatasetRef;
  binding?: DataBinding;
  density: "compacta" | "confortavel";
};

export type IndicatorProps = {
  frame?: FrameStyle;
  ignoreFilters?: boolean;
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

/**
 * Aparência de um filtro (segmentação, como no Power BI). Tudo opcional: ausente
 * = comportamento antigo (lista suspensa simples, campos de data).
 */
export type FilterStyle = {
  /** Filtro de lista: menu suspenso, lista com caixas de seleção ou blocos (botões). */
  display?: "suspenso" | "lista" | "blocos";
  /** Filtro de período: campos de data, campos + controle deslizante ou só atalhos. */
  rangeDisplay?: "campos" | "deslizante" | "atalhos";
  /** Permite marcar vários valores (nada marcado = todos). */
  multi?: boolean;
  /** Caixa de busca (lista e suspenso). */
  search?: boolean;
  /** Linha "Selecionar tudo" (só com seleção múltipla). */
  selectAll?: boolean;
  /** Título do filtro (padrão: sim). */
  showTitle?: boolean;
  /** Botão de limpar a seleção (padrão: sim). */
  showClear?: boolean;
  orientation?: "vertical" | "horizontal";
  fontSize?: number;
  textColor?: string;
  /** Cor da seleção (caixa marcada, bloco ativo, controle deslizante). */
  accent?: string;
  frame?: FrameStyle;
};

export type FilterProps = FilterStyle & {
  /** Vale para todas as páginas e para qualquer tabela que tenha uma coluna com o mesmo nome. */
  global?: boolean;
  /** "range" = intervalo de datas (valor `AAAA-MM-DD..AAAA-MM-DD`, qualquer ponta pode faltar). */
  mode?: "list" | "range";
  label: string;
  kind: FilterKind;
  options: string[];
  /** Valor padrão ("" = todos). */
  value: string;
  binding?: FilterBinding;
};

type ElementBase = {
  id: string;
  /** Elementos com o mesmo groupId são selecionados e movidos juntos. */
  groupId?: string;
  /** Não aparece no layout para celular. */
  hideOnMobile?: boolean;
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

export type DashboardPage = {
  id: string;
  name: string;
  canvas: { width: number; height: number; background?: string; palette?: string[] };
  elements: DashboardElement[];
};

export const MAX_PAGES = 20;

export type Dashboard = {
  /**
   * Várias páginas: a lista completa, em ordem. `canvas` e `elements` do topo
   * espelham a página ativa no editor e a primeira página no que é salvo.
   * Ausente = painel de uma página só.
   */
  pages?: DashboardPage[];
  measures?: DashboardMeasure[];
  id: string;
  schemaVersion: number;
  name: string;
  description: string;
  origin: "demo" | "user";
  createdAt: number;
  updatedAt: number;
  /** `background` ausente = cor padrão do tema; `palette` = cores dos gráficos do painel. */
  canvas: { width: number; height: number; background?: string; palette?: string[] };
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
  const { id, type, x, y, w, h, z, hidden, props, groupId, hideOnMobile } = raw;
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
    ...(typeof groupId === "string" && groupId.length <= 64 && { groupId }),
    ...(hideOnMobile === true && { hideOnMobile: true }),
    props,
  } as DashboardElement;
};

const sanitizeCanvas = (raw: unknown): Dashboard["canvas"] =>
  isRecord(raw)
    ? {
        width: typeof raw.width === "number" ? raw.width : CANVAS.width,
        height: typeof raw.height === "number" ? raw.height : CANVAS.height,
        ...(isPageBackground(raw.background) && { background: raw.background }),
        ...(isPagePalette(raw.palette) && { palette: raw.palette }),
      }
    : { ...CANVAS };

const sanitizeElementList = (raw: unknown, canvas: Dashboard["canvas"]): DashboardElement[] => {
  const elements = (Array.isArray(raw) ? raw : [])
    .map(sanitizeElement)
    .filter((el): el is DashboardElement => el !== null);
  return reindexLayers(elements.map((el) => ({ ...el, ...clampPosition(el, canvas) })));
};

const sanitizeMeasures = (raw: unknown): DashboardMeasure[] =>
  (Array.isArray(raw) ? raw : []).flatMap((entry): DashboardMeasure[] => {
    if (!isRecord(entry)) return [];
    const { id, name, sourceId, table, expr } = entry;
    if (![id, name, sourceId, table, expr].every((v) => typeof v === "string" && v.length > 0)) return [];
    return [
      {
        id: String(id).slice(0, 64),
        name: String(name).slice(0, 80),
        sourceId: String(sourceId).slice(0, 64),
        table: String(table).slice(0, 256),
        expr: String(expr).slice(0, 300),
      },
    ];
  });

/** Todos os elementos do painel, de todas as páginas. */
export const allElements = (dashboard: Pick<Dashboard, "elements" | "pages">): DashboardElement[] =>
  dashboard.pages && dashboard.pages.length > 0
    ? dashboard.pages.flatMap((page) => page.elements)
    : dashboard.elements;

/**
 * Valida o documento recebido (do servidor ou salvo antes): entradas inválidas
 * ou de versões futuras retornam null; páginas e medidas são saneadas.
 */
export const migrateDashboard = (raw: unknown): Dashboard | null => {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  if (typeof raw.schemaVersion !== "number") return null;
  if (raw.schemaVersion > DASHBOARD_SCHEMA_VERSION) return null;
  if (!Array.isArray(raw.elements)) return null;

  let canvas = sanitizeCanvas(raw.canvas);
  let elements = sanitizeElementList(raw.elements, canvas);

  let pages: DashboardPage[] | undefined;
  if (Array.isArray(raw.pages) && raw.pages.length > 1) {
    const seen = new Set<string>();
    pages = raw.pages.slice(0, MAX_PAGES).flatMap((entry, index): DashboardPage[] => {
      if (!isRecord(entry)) return [];
      const id = typeof entry.id === "string" && entry.id && !seen.has(entry.id) ? entry.id.slice(0, 64) : `pg-${index}`;
      seen.add(id);
      const pageCanvas = sanitizeCanvas(entry.canvas);
      return [
        {
          id,
          name: typeof entry.name === "string" && entry.name.trim() ? entry.name.trim().slice(0, 60) : `Página ${index + 1}`,
          canvas: pageCanvas,
          elements: sanitizeElementList(entry.elements, pageCanvas),
        },
      ];
    });
    if (pages.length > 1) {
      // o topo espelha a primeira página
      canvas = pages[0].canvas;
      elements = pages[0].elements;
    } else {
      pages = undefined;
    }
  }

  const measures = sanitizeMeasures(raw.measures);

  return {
    id: raw.id,
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    name: raw.name,
    description: typeof raw.description === "string" ? raw.description : "",
    origin: raw.origin === "demo" ? "demo" : "user",
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
    canvas,
    elements,
    ...(pages && { pages }),
    ...(measures.length > 0 && { measures }),
  };
};
