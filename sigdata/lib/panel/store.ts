/**
 * Widgets do painel analítico (workspace).
 * Cada widget é uma visualização posicionável/redimensionável, persistida por
 * projeto no servidor (/api/projects/:id/panel). Origem: tool create_visualization.
 */
import { create } from "zustand";
import { api, ApiError, background } from "@/lib/api/client";
import type { Kpi, Municipio, SeriesPoint } from "@/lib/demo-data";

const SAVE_DEBOUNCE_MS = 500;
const MAX_WIDGETS_PER_NOTEBOOK = 40;

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

export const WIDGET_DEFAULT_SIZE: Record<WidgetKind, { w: number; h: number }> = {
  linha: { w: 340, h: 220 },
  barras: { w: 340, h: 220 },
  kpi: { w: 220, h: 120 },
  tabela: { w: 380, h: 240 },
};

export const WIDGET_MIN_SIZE: Record<WidgetKind, { w: number; h: number }> = {
  linha: { w: 220, h: 160 },
  barras: { w: 220, h: 160 },
  kpi: { w: 160, h: 96 },
  tabela: { w: 260, h: 140 },
};

export const WIDGET_KIND_LABELS: Record<WidgetKind, string> = {
  linha: "Linha",
  barras: "Barras",
  kpi: "Indicador",
  tabela: "Tabela",
};

const uid = (): string => `w-${crypto.randomUUID().slice(0, 8)}`;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

type PanelStore = {
  widgetsByNotebook: Record<string, PanelWidget[]>;
  loaded: Record<string, boolean>;
  saveError: string | null;

  load: (notebookId: string) => void;
  getWidgets: (notebookId: string | null) => PanelWidget[];
  addWidget: (
    notebookId: string,
    widget: { kind: WidgetKind; title: string } & WidgetData,
  ) => PanelWidget | null;
  updateGeometry: (
    notebookId: string,
    id: string,
    geometry: { x?: number; y?: number; w?: number; h?: number },
  ) => void;
  bringToFront: (notebookId: string, id: string) => void;
  removeWidget: (notebookId: string, id: string) => void;
  clearNotebook: (notebookId: string) => void;
};

const panelTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const usePanelStore = create<PanelStore>((set, get) => {
  const schedulePersist = (notebookId: string) => {
    const previous = panelTimers.get(notebookId);
    if (previous) clearTimeout(previous);
    panelTimers.set(
      notebookId,
      setTimeout(() => {
        panelTimers.delete(notebookId);
        const widgets = get().widgetsByNotebook[notebookId] ?? [];
        api(`/api/projects/${notebookId}/panel`, { method: "PUT", json: { widgets } })
          .then(() => set({ saveError: null }))
          .catch((error: Error) => set({ saveError: error.message }));
      }, SAVE_DEBOUNCE_MS),
    );
  };

  const setWidgets = (notebookId: string, widgets: PanelWidget[]) => {
    set({ widgetsByNotebook: { ...get().widgetsByNotebook, [notebookId]: widgets } });
    schedulePersist(notebookId);
  };

  return {
    widgetsByNotebook: {},
    loaded: {},
    saveError: null,

    load: (notebookId) => {
      if (get().loaded[notebookId]) return;
      set({ loaded: { ...get().loaded, [notebookId]: true } });
      background(
        api<{ widgets: PanelWidget[] }>(`/api/projects/${notebookId}/panel`)
          .catch((error: unknown) => {
            // projeto recém-criado (POST ainda em andamento)
            if (error instanceof ApiError && error.status === 404) return { widgets: [] };
            throw error;
          })
          .then(({ widgets }) => {
            // não sobrescreve widgets adicionados enquanto a requisição estava em voo
            if (get().widgetsByNotebook[notebookId]?.length) return;
            set({ widgetsByNotebook: { ...get().widgetsByNotebook, [notebookId]: widgets } });
          }),
        "carregar painel",
      );
    },

    getWidgets: (notebookId) =>
      notebookId ? (get().widgetsByNotebook[notebookId] ?? []) : [],

    addWidget: (notebookId, input) => {
      if (!notebookId) return null;
      const existing = get().widgetsByNotebook[notebookId] ?? [];
      if (existing.length >= MAX_WIDGETS_PER_NOTEBOOK) return null;

      const size = WIDGET_DEFAULT_SIZE[input.kind];
      const topLevel = existing.reduce((max, widget) => Math.max(max, widget.z), 0) + 1;
      const column = existing.length % 2;
      const row = Math.floor(existing.length / 2);
      const widget: PanelWidget = {
        id: uid(),
        kind: input.kind,
        title: input.title.trim() || "Visualização",
        x: 12 + column * (size.w + 16),
        y: 12 + row * (size.h + 16),
        w: size.w,
        h: size.h,
        z: topLevel,
        ...(input.resultId && { resultId: input.resultId }),
        ...(input.series && { series: input.series }),
        ...(input.kpis && { kpis: input.kpis }),
        ...(input.rows && { rows: input.rows }),
        ...(input.table && { table: input.table }),
      };

      setWidgets(notebookId, [...existing, widget]);
      return widget;
    },

    updateGeometry: (notebookId, id, geometry) => {
      const widgets = get().widgetsByNotebook[notebookId];
      if (!widgets) return;
      setWidgets(
        notebookId,
        widgets.map((widget) => {
          if (widget.id !== id) return widget;
          const min = WIDGET_MIN_SIZE[widget.kind];
          return {
            ...widget,
            x: geometry.x !== undefined ? clamp(geometry.x, 0, 4000) : widget.x,
            y: geometry.y !== undefined ? clamp(geometry.y, 0, 8000) : widget.y,
            w: geometry.w !== undefined ? clamp(geometry.w, min.w, 1200) : widget.w,
            h: geometry.h !== undefined ? clamp(geometry.h, min.h, 1200) : widget.h,
          };
        }),
      );
    },

    bringToFront: (notebookId, id) => {
      const widgets = get().widgetsByNotebook[notebookId];
      if (!widgets) return;
      const maxZ = widgets.reduce((max, widget) => Math.max(max, widget.z), 0);
      const target = widgets.find((widget) => widget.id === id);
      if (!target || target.z === maxZ) return;
      setWidgets(
        notebookId,
        widgets.map((widget) => (widget.id === id ? { ...widget, z: maxZ + 1 } : widget)),
      );
    },

    removeWidget: (notebookId, id) => {
      const widgets = get().widgetsByNotebook[notebookId];
      if (!widgets) return;
      const next = widgets.filter((widget) => widget.id !== id);
      if (next.length === widgets.length) return;
      setWidgets(notebookId, next);
    },

    clearNotebook: (notebookId) => {
      const timer = panelTimers.get(notebookId);
      if (timer) clearTimeout(timer);
      panelTimers.delete(notebookId);
      const widgetsByNotebook = { ...get().widgetsByNotebook };
      const loaded = { ...get().loaded };
      delete widgetsByNotebook[notebookId];
      delete loaded[notebookId];
      set({ widgetsByNotebook, loaded });
    },
  };
});
