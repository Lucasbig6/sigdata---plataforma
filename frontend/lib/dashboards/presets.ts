/**
 * Biblioteca de elementos do editor: presets de conteúdo/tamanho usados pela
 * barra lateral e pelo seed dos dashboards demonstrativos.
 */
import {
  AreaChart as AreaChartIcon,
  BarChart3,
  ChartNoAxesCombined,
  ChartScatter,
  Donut,
  Funnel,
  Gauge,
  Grid3x3,
  Hash,
  LayoutGrid,
  Heading,
  Image as ImageIcon,
  LineChart as LineChartIcon,
  ListFilter,
  Minus,
  Percent,
  PieChart as PieChartIcon,
  Radar,
  RectangleHorizontal,
  Table as TableIcon,
  TrendingUp,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { ChartType } from "@shared/charts/types";
import { FILTER_OPTIONS } from "./datasets";
import {
  CANVAS,
  ELEMENT_SIZES,
  clampPosition,
  uid,
  type DashboardElement,
  type ElementType,
} from "./types";

/** MIME usado pelo drag nativo entre a biblioteca e o canvas. */
export const ELEMENT_MIME = "application/x-sigdata-element";

export type LibraryItem = {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  type: ElementType;
  size?: { w: number; h: number };
  defaultProps: () => Record<string, unknown>;
};

export type LibraryGroup = {
  id: string;
  label: string;
  items: LibraryItem[];
};

const demoDataset = () => ({
  source: "demo",
  ref: "demo",
  categoryField: "periodo",
  valueField: "valor",
});

const chartItem = (
  key: string,
  label: string,
  chartType: ChartType,
  description: string,
  icon: LucideIcon,
): LibraryItem => ({
  key,
  label,
  description,
  icon,
  type: "chart",
  defaultProps: () => ({
    chartType,
    title: label,
    showTitle: true,
    subtitle: "Dados de demonstração",
    dataset: demoDataset(),
    color: 2,
    showGrid: true,
    showLegend: chartType === "pie" || chartType === "donut" || chartType === "funnel",
  }),
});

export const ELEMENT_LIBRARY: LibraryGroup[] = [
  {
    id: "visualizacoes",
    label: "Visualizações",
    items: [
      chartItem("bar", "Gráfico de barras", "bar", "Comparação entre categorias.", BarChart3),
      chartItem("line", "Gráfico de linhas", "line", "Evolução ao longo do tempo.", LineChartIcon),
      chartItem("pie", "Gráfico de pizza", "pie", "Composição percentual.", PieChartIcon),
      chartItem("area", "Gráfico de área", "area", "Volume acumulado no período.", AreaChartIcon),
      chartItem("hbar", "Barras horizontais", "hbar", "Ranking com rótulos longos.", BarChart3),
      chartItem("combo", "Combinado", "combo", "Barras e linhas no mesmo gráfico.", ChartNoAxesCombined),
      chartItem("donut", "Gráfico de rosca", "donut", "Composição com destaque central.", Donut),
      chartItem("scatter", "Dispersão", "scatter", "Relação entre duas medidas.", ChartScatter),
      chartItem("radar", "Radar", "radar", "Perfil em várias dimensões.", Radar),
      chartItem("funnel", "Funil", "funnel", "Etapas de um processo.", Funnel),
      chartItem("gauge", "Medidor", "gauge", "Um valor contra uma meta.", Gauge),
      chartItem("treemap", "Treemap", "treemap", "Proporção por área.", LayoutGrid),
      chartItem("heatmap", "Mapa de calor", "heatmap", "Intensidade entre duas categorias.", Grid3x3),
      {
        key: "table",
        label: "Tabela",
        description: "Linhas e colunas de uma tabela.",
        icon: TableIcon,
        type: "table",
        defaultProps: () => ({
          title: "Tabela de municípios",
          showTitle: true,
          dataset: demoDataset(),
          density: "confortavel",
        }),
      },
    ],
  },
  {
    id: "indicadores",
    label: "Indicadores",
    items: [
      {
        key: "kpi",
        label: "KPI numérico",
        description: "Valor absoluto em destaque.",
        icon: Hash,
        type: "kpi",
        defaultProps: () => ({
          title: "Índice geral",
          value: "74,2",
          description: "base 0–100",
          unit: "",
          delta: 0,
          showDelta: false,
        }),
      },
      {
        key: "percent",
        label: "Indicador percentual",
        description: "Valor entre 0 e 100%.",
        icon: Percent,
        type: "percent",
        defaultProps: () => ({
          title: "Cobertura",
          value: "86",
          description: "serviços mapeados",
          unit: "%",
          delta: 5.1,
          showDelta: true,
        }),
      },
      {
        key: "comparison",
        label: "Comparação entre períodos",
        description: "Variação frente ao período anterior.",
        icon: TrendingUp,
        type: "comparison",
        defaultProps: () => ({
          title: "Variação no período",
          value: "+3,4",
          description: "vs. período anterior",
          unit: "%",
          delta: 3.4,
          showDelta: true,
        }),
      },
    ],
  },
  {
    id: "conteudo",
    label: "Conteúdo",
    items: [
      {
        key: "text",
        label: "Texto",
        description: "Parágrafo explicativo livre.",
        icon: Type,
        type: "text",
        defaultProps: () => ({
          content: "Texto explicativo do painel.",
          fontSize: 16,
          bold: false,
          align: "left",
          color: "#E8ECEF",
        }),
      },
      {
        key: "title",
        label: "Título",
        description: "Chamada principal do painel.",
        icon: Heading,
        type: "title",
        defaultProps: () => ({
          content: "Título do painel",
          fontSize: 30,
          bold: true,
          align: "left",
          color: "#E8ECEF",
        }),
      },
      {
        key: "image",
        label: "Imagem demonstrativa",
        description: "Ilustração gerada localmente.",
        icon: ImageIcon,
        type: "image",
        defaultProps: () => ({
          alt: "Imagem demonstrativa",
          variant: "gradiente",
          accent: 2,
          fit: "cover",
        }),
      },
      {
        key: "divider",
        label: "Divisor",
        description: "Separação horizontal.",
        icon: Minus,
        type: "divider",
        defaultProps: () => ({
          thickness: 2,
          color: "#39464B",
          style: "solid",
        }),
      },
      {
        key: "shape",
        label: "Forma geométrica",
        description: "Retângulo ou círculo decorativo.",
        icon: RectangleHorizontal,
        type: "shape",
        defaultProps: () => ({
          shape: "retangulo",
          fill: "rgba(128, 206, 196, 0.16)",
          border: "rgba(128, 206, 196, 0.45)",
          borderWidth: 1,
          radius: 14,
        }),
      },
    ],
  },
  {
    id: "filtros",
    label: "Filtros",
    items: [
      {
        key: "filter-categoria",
        label: "Filtro por coluna",
        description: "Filtra os elementos da mesma tabela pelo valor escolhido.",
        icon: ListFilter,
        type: "filter",
        defaultProps: () => ({
          label: "Filtro",
          kind: "categoria",
          options: FILTER_OPTIONS.categoria,
          value: FILTER_OPTIONS.categoria[0],
        }),
      },
    ],
  },
];

export const findLibraryItem = (key: string): LibraryItem | undefined => {
  for (const group of ELEMENT_LIBRARY) {
    const item = group.items.find((entry) => entry.key === key);
    if (item) return item;
  }
  return undefined;
};

/** Encontra um espaço livre (com cascata) para o novo elemento. */
export const findPlacement = (
  size: { w: number; h: number },
  existing: DashboardElement[],
  origin = { x: 80, y: 80 },
  canvas: { width: number; height: number } = CANVAS,
): { x: number; y: number } => {
  const step = 36;
  const limitX = Math.max(0, canvas.width - size.w - 16);
  const limitY = Math.max(0, canvas.height - size.h - 16);
  const overlaps = (px: number, py: number) =>
    existing.some(
      (el) =>
        px < el.x + el.w + 12 &&
        px + size.w + 12 > el.x &&
        py < el.y + el.h + 12 &&
        py + size.h + 12 > el.y,
    );

  let x = Math.min(origin.x, limitX);
  let y = Math.min(origin.y, limitY);

  for (let i = 0; i < 80; i += 1) {
    if (!overlaps(x, y)) return { x, y };
    x += step;
    if (x > limitX) {
      x = Math.min(origin.x, limitX);
      y += step;
      if (y > limitY) break;
    }
  }
  return { x: Math.min(x, limitX), y: Math.min(y, limitY) };
};

export const createElement = (
  item: LibraryItem,
  placement: {
    x?: number;
    y?: number;
    z?: number;
    size?: { w: number; h: number };
    props?: Record<string, unknown>;
    existing?: DashboardElement[];
    canvas?: { width: number; height: number };
  } = {},
): DashboardElement => {
  const canvas = placement.canvas ?? CANVAS;
  const size = placement.size ?? item.size ?? ELEMENT_SIZES[item.type];
  const origin =
    placement.x !== undefined && placement.y !== undefined
      ? { x: placement.x, y: placement.y }
      : findPlacement(size, placement.existing ?? [], undefined, canvas);

  const position = clampPosition({ ...origin, w: size.w, h: size.h }, canvas);

  return {
    id: uid(item.type),
    type: item.type,
    x: position.x,
    y: position.y,
    w: size.w,
    h: size.h,
    z: placement.z ?? 0,
    hidden: false,
    props: { ...item.defaultProps(), ...placement.props },
  } as DashboardElement;
};
