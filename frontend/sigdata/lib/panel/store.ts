/**
 * Widgets do painel analítico (workspace).
 * Cada widget é uma visualização posicionar/redimensionável, persistida por
 * notebook em localStorage. Origem: tool create_visualization na conversa.
 */
import { create } from "zustand";
import type { Kpi, Municipio, SeriesPoint } from "@/lib/demo-data";

const STORAGE_KEY = "sigdata.panel.v1";
const SAVE_DEBOUNCE_MS = 300;
const MAX_WIDGETS_PER_NOTEBOOK = 40;

export type WidgetKind = "linha" | "barras" | "kpi" | "tabela";

export type PanelWidget = {
  id: string;
  kind: WidgetKind;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  series?: SeriesPoint[];
  kpis?: Kpi[];
  rows?: Municipio[];
};

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

type Persisted = {
  widgetsByNotebook?: Record<string, PanelWidget[]>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const sanitizeWidget = (raw: unknown): PanelWidget | null => {
  if (!isRecord(raw)) return null;
  const { id, kind, title, x, y, w, h, z, series, kpis, rows } = raw;
  if (typeof id !== "string") return null;
  if (kind !== "linha" && kind !== "barras" && kind !== "kpi" && kind !== "tabela") return null;
  if (typeof title !== "string") return null;
  if (typeof x !== "number" || !Number.isFinite(x)) return null;
  if (typeof y !== "number" || !Number.isFinite(y)) return null;
  if (typeof w !== "number" || !Number.isFinite(w)) return null;
  if (typeof h !== "number" || !Number.isFinite(h)) return null;
  if (typeof z !== "number" || !Number.isFinite(z)) return null;
  return {
    id,
    kind,
    title,
    x,
    y,
    w,
    h,
    z,
    ...(Array.isArray(series) && { series: series as SeriesPoint[] }),
    ...(Array.isArray(kpis) && { kpis: kpis as Kpi[] }),
    ...(Array.isArray(rows) && { rows: rows as Municipio[] }),
  };
};

const readPersisted = (): Record<string, PanelWidget[]> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Persisted;
    if (!isRecord(parsed.widgetsByNotebook)) return {};
    const result: Record<string, PanelWidget[]> = {};
    for (const [notebookId, widgets] of Object.entries(parsed.widgetsByNotebook)) {
      if (!Array.isArray(widgets)) continue;
      const safe = widgets
        .map(sanitizeWidget)
        .filter((widget): widget is PanelWidget => widget !== null)
        .slice(0, MAX_WIDGETS_PER_NOTEBOOK);
      if (safe.length > 0) result[notebookId] = safe;
    }
    return result;
  } catch {
    return {};
  }
};

const persist = (widgetsByNotebook: Record<string, PanelWidget[]>) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ widgetsByNotebook }));
  } catch {
    /* modo privado / storage indisponível */
  }
};

const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `w-${crypto.randomUUID().slice(0, 8)}`
    : `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

type PanelStore = {
  hydrated: boolean;
  widgetsByNotebook: Record<string, PanelWidget[]>;

  hydrate: () => void;
  getWidgets: (notebookId: string | null) => PanelWidget[];
  addWidget: (
    notebookId: string,
    widget: {
      kind: WidgetKind;
      title: string;
      series?: SeriesPoint[];
      kpis?: Kpi[];
      rows?: Municipio[];
    },
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

const schedulePersist = (
  get: () => PanelStore,
  notebookId: string,
) => {
  const previous = panelTimers.get(notebookId);
  if (previous) clearTimeout(previous);
  panelTimers.set(
    notebookId,
    setTimeout(() => {
      panelTimers.delete(notebookId);
      persist(get().widgetsByNotebook);
    }, SAVE_DEBOUNCE_MS),
  );
};

export const usePanelStore = create<PanelStore>((set, get) => ({
  hydrated: false,
  widgetsByNotebook: {},

  hydrate: () => {
    if (get().hydrated) return;
    set({ hydrated: true, widgetsByNotebook: readPersisted() });
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
      ...(input.series && { series: input.series }),
      ...(input.kpis && { kpis: input.kpis }),
      ...(input.rows && { rows: input.rows }),
    };

    const widgetsByNotebook = {
      ...get().widgetsByNotebook,
      [notebookId]: [...existing, widget],
    };
    set({ widgetsByNotebook });
    schedulePersist(get, notebookId);
    return widget;
  },

  updateGeometry: (notebookId, id, geometry) => {
    const widgets = get().widgetsByNotebook[notebookId];
    if (!widgets) return;
    const next = widgets.map((widget) => {
      if (widget.id !== id) return widget;
      const min = WIDGET_MIN_SIZE[widget.kind];
      return {
        ...widget,
        x: geometry.x !== undefined ? clamp(geometry.x, 0, 4000) : widget.x,
        y: geometry.y !== undefined ? clamp(geometry.y, 0, 8000) : widget.y,
        w: geometry.w !== undefined ? clamp(geometry.w, min.w, 1200) : widget.w,
        h: geometry.h !== undefined ? clamp(geometry.h, min.h, 1200) : widget.h,
      };
    });
    set({ widgetsByNotebook: { ...get().widgetsByNotebook, [notebookId]: next } });
    schedulePersist(get, notebookId);
  },

  bringToFront: (notebookId, id) => {
    const widgets = get().widgetsByNotebook[notebookId];
    if (!widgets) return;
    const maxZ = widgets.reduce((max, widget) => Math.max(max, widget.z), 0);
    const target = widgets.find((widget) => widget.id === id);
    if (!target || target.z === maxZ) return;
    const next = widgets.map((widget) =>
      widget.id === id ? { ...widget, z: maxZ + 1 } : widget,
    );
    set({ widgetsByNotebook: { ...get().widgetsByNotebook, [notebookId]: next } });
    schedulePersist(get, notebookId);
  },

  removeWidget: (notebookId, id) => {
    const widgets = get().widgetsByNotebook[notebookId];
    if (!widgets) return;
    const next = widgets.filter((widget) => widget.id !== id);
    if (next.length === widgets.length) return;
    set({ widgetsByNotebook: { ...get().widgetsByNotebook, [notebookId]: next } });
    schedulePersist(get, notebookId);
  },

  clearNotebook: (notebookId) => {
    const pending: Record<string, PanelWidget[]> = { ...get().widgetsByNotebook };
    if (!(notebookId in pending)) return;
    delete pending[notebookId];
    set({ widgetsByNotebook: pending });
    persist(pending);
  },
}));
