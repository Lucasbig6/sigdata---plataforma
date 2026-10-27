/**
 * Modelos de página: montam um conjunto de elementos já posicionados e ligados
 * à fonte padrão, proporcionais à largura da página atual.
 */
import { builderFor, defaultSource, describeBinding } from "@/lib/dashboards/auto-binding";
import { createElement, findLibraryItem, type LibraryItem } from "@/lib/dashboards/presets";
import { useDashboardsStore } from "@/lib/dashboards/store";
import type { Canvas } from "@/lib/dashboards/layout-ops";
import type { DashboardElement } from "@/lib/dashboards/types";
import { useDatasetsStore } from "@/lib/datasets/store";
import type { DataSource, SourceTable } from "@/lib/domain/sources";

export type TemplateId = "visao-geral" | "dois-graficos" | "relatorio";

export const TEMPLATES: { id: TemplateId; label: string; description: string }[] = [
  { id: "visao-geral", label: "Visão geral", description: "Título, 4 indicadores, 2 gráficos e uma tabela." },
  { id: "dois-graficos", label: "Dois gráficos", description: "Título e dois gráficos lado a lado." },
  { id: "relatorio", label: "Relatório", description: "Título, filtro, indicadores e um gráfico grande." },
];

type Slot = {
  key: string;
  rect: { x: number; y: number; w: number; h: number };
  /** Posição do indicador entre os numéricos da tabela (para variar a medida). */
  nth?: number;
  chartType?: string;
  props?: Record<string, unknown>;
};

const GAP = 16;

const layout = (id: TemplateId, canvas: Canvas): { slots: Slot[]; height: number } => {
  const m = Math.max(16, Math.round(canvas.width * 0.02));
  const inner = canvas.width - m * 2;
  const quarter = Math.floor((inner - GAP * 3) / 4);
  const half = Math.floor((inner - GAP) / 2);
  const titleRow = { x: m, y: m, w: inner, h: 64 };
  const kpiY = m + 64 + GAP;
  const kpis: Slot[] = [0, 1, 2, 3].map((i) => ({
    key: "kpi",
    nth: i,
    rect: { x: m + i * (quarter + GAP), y: kpiY, w: quarter, h: 132 },
  }));

  if (id === "dois-graficos") {
    const y = m + 64 + GAP;
    return {
      slots: [
        { key: "title", rect: titleRow, props: { content: "Título do painel" } },
        { key: "bar", rect: { x: m, y, w: half, h: 380 } },
        { key: "line", rect: { x: m + half + GAP, y, w: half, h: 380 } },
      ],
      height: y + 380 + m,
    };
  }

  if (id === "relatorio") {
    const filterY = m + 64 + GAP;
    const kpiRowY = filterY + 92 + GAP;
    const shifted = kpis.slice(0, 3).map((slot, i) => ({
      ...slot,
      rect: { ...slot.rect, y: kpiRowY, w: Math.floor((inner - GAP * 2) / 3), x: m + i * (Math.floor((inner - GAP * 2) / 3) + GAP) },
    }));
    const chartY = kpiRowY + 132 + GAP;
    return {
      slots: [
        { key: "title", rect: titleRow, props: { content: "Relatório" } },
        { key: "filter-categoria", rect: { x: m, y: filterY, w: 320, h: 92 } },
        ...shifted,
        { key: "area", rect: { x: m, y: chartY, w: inner, h: 400 } },
      ],
      height: chartY + 400 + m,
    };
  }

  const chartY = kpiY + 132 + GAP;
  const tableY = chartY + 320 + GAP;
  return {
    slots: [
      { key: "title", rect: titleRow, props: { content: "Visão geral" } },
      ...kpis,
      { key: "bar", rect: { x: m, y: chartY, w: half, h: 320 } },
      { key: "line", rect: { x: m + half + GAP, y: chartY, w: half, h: 320 } },
      { key: "table", rect: { x: m, y: tableY, w: inner, h: 300 } },
    ],
    height: tableY + 300 + m,
  };
};

const pickTable = (source: DataSource): SourceTable | undefined =>
  source.tables.find((t) => t.columns.some((c) => c.kind === "numero")) ?? source.tables[0];

const propsFor = (
  item: LibraryItem,
  slot: Slot,
  source: DataSource | undefined,
  table: SourceTable | undefined,
): Record<string, unknown> | undefined => {
  const base = slot.props;
  if (!source || !table) return base;

  if (item.type === "kpi") {
    const numeric = table.columns.filter((c) => c.kind === "numero");
    const column = numeric[(slot.nth ?? 0) % Math.max(numeric.length, 1)];
    const binding = { ...builderFor("kpi", source.id, table), measure: column?.name, agg: column ? ("sum" as const) : ("count" as const) };
    return { ...base, binding, title: describeBinding(binding), description: source.name };
  }
  if (item.type === "chart" || item.type === "table") {
    const binding = builderFor(item.type, source.id, table);
    return { ...base, binding, title: item.type === "table" ? table.name : describeBinding(binding), subtitle: "" };
  }
  if (item.type === "filter") {
    const column = table.columns.find((c) => c.kind === "texto") ?? table.columns[0];
    return column
      ? { ...base, label: column.name, binding: { sourceId: source.id, table: table.name, column: column.name }, options: [], value: "" }
      : base;
  }
  return base;
};

export const buildTemplate = (
  id: TemplateId,
  canvas: Canvas,
  sources: DataSource[],
  preferredSourceId: string,
): { elements: DashboardElement[]; height: number } => {
  const source = defaultSource(sources, preferredSourceId);
  const table = source ? pickTable(source) : undefined;
  const { slots, height } = layout(id, canvas);
  const elements = slots.flatMap((slot) => {
    const item = findLibraryItem(slot.key);
    if (!item) return [];
    return [
      createElement(item, {
        x: slot.rect.x,
        y: slot.rect.y,
        size: { w: slot.rect.w, h: slot.rect.h },
        props: propsFor(item, slot, source, table),
        canvas: { width: canvas.width, height: Math.max(canvas.height, height) },
      }),
    ];
  });
  return { elements, height };
};

/** Aplica o modelo ao painel aberto (a página cresce se faltar altura). */
export const applyTemplate = (id: TemplateId) => {
  const store = useDashboardsStore.getState();
  const doc = store.current();
  if (!doc) return;
  const sources = useDatasetsStore.getState().datasets;
  const { elements, height } = buildTemplate(id, doc.canvas, sources, store.preferredSourceId);
  if (height > doc.canvas.height) store.setCanvasSize({ width: doc.canvas.width, height });
  store.addElements(elements);
};
