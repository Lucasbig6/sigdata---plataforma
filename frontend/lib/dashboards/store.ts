/**
 * Estado do editor de dashboards SIGDATA.
 *
 * - Coleção de dashboards persistida no servidor (/api/dashboards).
 * - Editor com histórico (desfazer/refazer) por snapshots.
 * - Alterações só vão para o servidor no `save()` (daí o indicador de
 *   "alterações não salvas"). Criar/remover dashboards persiste na hora.
 * - Links públicos de leitura: `share()` / `unshare()`.
 */
import { create } from "zustand";
import { api, background } from "@/lib/api/client";
import { useAnalysesStore, type SavedAnalysis } from "./analyses";
import { createElement, type LibraryItem } from "./presets";
import {
  CANVAS_LIMITS,
  ELEMENT_MIN,
  clamp,
  clampPosition,
  reindexLayers,
  topLevelZ,
  uid,
  type Dashboard,
  type DashboardElement,
} from "./types";

const HISTORY_LIMIT = 80;
const HISTORY_COALESCE_MS = 700;

type HistoryKey = string | null;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

type ServerDashboard = Dashboard & { shareToken: string | null };

/** POSTs de criação em andamento: o primeiro PUT/DELETE espera por eles. */
const pendingCreates = new Map<string, Promise<unknown>>();
const afterCreate = (id: string, fn: () => Promise<unknown>) =>
  (pendingCreates.get(id) ?? Promise.resolve()).then(fn);

const toPayload = (doc: Dashboard) => ({
  id: doc.id,
  schemaVersion: doc.schemaVersion,
  name: doc.name,
  description: doc.description,
  origin: doc.origin,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
  canvas: doc.canvas,
  elements: doc.elements,
});

const byZ = (a: DashboardElement, b: DashboardElement) => a.z - b.z;

type SigdataDashboardsStore = {
  hydrated: boolean;
  loadError: string | null;
  order: string[];
  dashboards: Record<string, Dashboard>;
  shareTokens: Record<string, string | null>;
  saving: boolean;
  saveError: string | null;
  /** Última versão salva do documento aberto (para "Descartar"). */
  baseline: Dashboard | null;
  /** Preferências do editor (não vão para o documento). */
  snapToGrid: boolean;
  showGrid: boolean;
  setSnapToGrid: (value: boolean) => void;
  setShowGrid: (value: boolean) => void;

  currentId: string | null;
  selectedId: string | null;
  preview: boolean;
  dirty: boolean;
  savedAt: number | null;
  past: Dashboard[];
  future: Dashboard[];
  historyKey: HistoryKey;
  historyAt: number;

  hydrate: () => void;
  list: () => Dashboard[];
  current: () => Dashboard | null;
  select: (id: string | null) => void;
  setPreview: (preview: boolean) => void;
  openDashboard: (id: string | null) => void;
  createDashboard: () => string;
  deleteDashboard: (id: string) => void;
  rename: (name: string) => void;

  beginTransaction: (key: string) => void;
  endTransaction: () => void;
  undo: () => void;
  redo: () => void;
  save: () => Promise<void>;
  share: (id: string) => Promise<string>;
  unshare: (id: string) => Promise<void>;
  /** Abre um dashboard recebido por link público (somente leitura). */
  loadPublic: (dashboard: Dashboard, analyses: SavedAnalysis[]) => void;

  addElement: (
    item: LibraryItem,
    placement?: { x?: number; y?: number },
    props?: Record<string, unknown>,
  ) => string | null;
  /** Muda o tamanho da página; elementos são reposicionados para caber. */
  setCanvasSize: (size: { width: number; height: number }) => void;
  discardChanges: () => void;
  updateProps: (id: string, patch: Record<string, unknown>, field?: string) => void;
  patchElement: (
    id: string,
    patch: Partial<DashboardElement>,
    options?: { transaction?: string },
  ) => void;
  moveElementTo: (id: string, x: number, y: number) => void;
  resizeElementTo: (id: string, size: { w: number; h: number; x?: number; y?: number }) => void;
  nudge: (id: string, dx: number, dy: number) => void;
  duplicateElement: (id: string) => void;
  removeElement: (id: string) => void;
  setHidden: (id: string, hidden: boolean) => void;
  moveLayer: (id: string, direction: "front" | "back" | "up" | "down") => void;
};

let hydrating: Promise<void> | null = null;

const PREF_KEY = "sigdata.editor.prefs.v1";

const readPref = (key: string, fallback: boolean): boolean => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = JSON.parse(window.localStorage.getItem(PREF_KEY) ?? "{}") as Record<string, unknown>;
    return typeof raw[key] === "boolean" ? (raw[key] as boolean) : fallback;
  } catch {
    return fallback;
  }
};

const writePref = (key: string, value: boolean) => {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.parse(window.localStorage.getItem(PREF_KEY) ?? "{}") as Record<string, unknown>;
    window.localStorage.setItem(PREF_KEY, JSON.stringify({ ...raw, [key]: value }));
  } catch {
    /* preferências são opcionais */
  }
};

export const useDashboardsStore = create<SigdataDashboardsStore>((set, get) => {
  const mutateCurrent = (transform: (doc: Dashboard) => Dashboard | null, dirty = true) => {
    const { currentId, dashboards } = get();
    if (!currentId) return;
    const doc = dashboards[currentId];
    if (!doc) return;
    const next = transform(doc);
    if (!next) return;
    set({
      dashboards: { ...dashboards, [currentId]: next },
      dirty: dirty || get().dirty,
    });
  };

  const pushSnapshot = (key: string) => {
    const { past, historyKey, historyAt } = get();
    const doc = get().current();
    if (!doc) return;
    const now = Date.now();
    if (key && key === historyKey && now - historyAt < HISTORY_COALESCE_MS) {
      set({ historyAt: now, future: [] });
      return;
    }
    set({
      past: [...past.slice(-(HISTORY_LIMIT - 1)), clone(doc)],
      future: [],
      historyKey: key,
      historyAt: now,
    });
  };

  return {
    hydrated: false,
    loadError: null,
    order: [],
    dashboards: {},
    shareTokens: {},
    saving: false,
    saveError: null,
    baseline: null,
    snapToGrid: readPref("snap", true),
    showGrid: readPref("grid", true),
    setSnapToGrid: (value) => {
      writePref("snap", value);
      set({ snapToGrid: value });
    },
    setShowGrid: (value) => {
      writePref("grid", value);
      set({ showGrid: value });
    },

    currentId: null,
    selectedId: null,
    preview: false,
    dirty: false,
    savedAt: null,
    past: [],
    future: [],
    historyKey: null,
    historyAt: 0,

    hydrate: () => {
      if (get().hydrated || hydrating) return;
      useAnalysesStore.getState().hydrate();
      hydrating = api<ServerDashboard[]>("/api/dashboards")
        .then((list) => {
          set({
            hydrated: true,
            loadError: null,
            order: list.map((dashboard) => dashboard.id),
            dashboards: Object.fromEntries(
              list.map(({ shareToken: _token, ...dashboard }) => [dashboard.id, dashboard]),
            ),
            shareTokens: Object.fromEntries(list.map((d) => [d.id, d.shareToken])),
          });
        })
        .catch((error: Error) => set({ hydrated: true, loadError: error.message }))
        .finally(() => {
          hydrating = null;
        });
    },

    list: () => {
      const { order, dashboards } = get();
      return order
        .map((id) => dashboards[id])
        .filter((dashboard): dashboard is Dashboard => Boolean(dashboard))
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },

    current: () => {
      const { currentId, dashboards } = get();
      return currentId ? (dashboards[currentId] ?? null) : null;
    },

    select: (id) => set({ selectedId: id }),
    setPreview: (preview) =>
      set(preview ? { preview: true, selectedId: null } : { preview: false }),

    openDashboard: (id) =>
      set({
        baseline: id && get().dashboards[id] ? clone(get().dashboards[id]) : null,
        currentId: id,
        selectedId: null,
        preview: false,
        dirty: false,
        savedAt: null,
        past: [],
        future: [],
        historyKey: null,
      }),

    createDashboard: () => {
      const { order, dashboards } = get();
      const now = Date.now();
      const dashboard: Dashboard = {
        id: uid("db"),
        schemaVersion: 1,
        name: "Novo dashboard",
        description: "",
        origin: "user",
        createdAt: now,
        updatedAt: now,
        canvas: { width: 1600, height: 1000 },
        elements: [],
      };
      const next = {
        order: [dashboard.id, ...order],
        dashboards: { ...dashboards, [dashboard.id]: dashboard },
      };
      set({
        order: next.order,
        dashboards: next.dashboards,
        currentId: dashboard.id,
        baseline: clone(dashboard),
        selectedId: null,
        preview: false,
        dirty: false,
        past: [],
        future: [],
        historyKey: null,
      });
      const request = api("/api/dashboards", { method: "POST", json: toPayload(dashboard) }).finally(
        () => pendingCreates.delete(dashboard.id),
      );
      pendingCreates.set(dashboard.id, request);
      background(request, "criar dashboard");
      return dashboard.id;
    },

    deleteDashboard: (id) => {
      const { order, dashboards, currentId } = get();
      const nextOrder = order.filter((entry) => entry !== id);
      const nextDashboards = { ...dashboards };
      delete nextDashboards[id];
      set({
        order: nextOrder,
        dashboards: nextDashboards,
        currentId: currentId === id ? null : currentId,
      });
      background(
        afterCreate(id, () => api(`/api/dashboards/${id}`, { method: "DELETE" })),
        "excluir dashboard",
      );
    },

    rename: (name) => {
      pushSnapshot("rename");
      mutateCurrent((doc) => ({ ...doc, name, updatedAt: Date.now() }));
    },

    beginTransaction: (key) => pushSnapshot(key),
    endTransaction: () => set({ historyKey: null }),

    undo: () => {
      const { past, future, currentId } = get();
      const doc = get().current();
      if (!currentId || !doc || past.length === 0) return;
      const previous = past[past.length - 1];
      set({
        past: past.slice(0, -1),
        future: [...future, clone(doc)],
        dashboards: { ...get().dashboards, [currentId]: previous },
        historyKey: null,
        dirty: true,
        selectedId:
          get().selectedId && previous.elements.some((el) => el.id === get().selectedId)
            ? get().selectedId
            : null,
      });
    },

    redo: () => {
      const { past, future, currentId } = get();
      const doc = get().current();
      if (!currentId || !doc || future.length === 0) return;
      const next = future[future.length - 1];
      set({
        future: future.slice(0, -1),
        past: [...past, clone(doc)],
        dashboards: { ...get().dashboards, [currentId]: next },
        historyKey: null,
        dirty: true,
      });
    },

    save: async () => {
      const doc = get().current();
      if (!doc) return;
      const updated: Dashboard = { ...doc, updatedAt: Date.now() };
      set({
        dashboards: { ...get().dashboards, [doc.id]: updated },
        saving: true,
        saveError: null,
      });
      try {
        await afterCreate(doc.id, () =>
          api(`/api/dashboards/${doc.id}`, { method: "PUT", json: toPayload(updated) }),
        );
        // só limpa o "não salvo" se nada mudou durante a requisição
        const stillSame = get().dashboards[doc.id] === updated;
        set({
          saving: false,
          savedAt: Date.now(),
          baseline: clone(updated),
          ...(stillSame && { dirty: false, past: [], future: [], historyKey: null }),
        });
      } catch (error) {
        set({ saving: false, saveError: (error as Error).message, dirty: true });
      }
    },

    share: async (id) => {
      const { token } = await afterCreate(id, () =>
        api<{ token: string }>(`/api/dashboards/${id}/share`, { method: "POST" }),
      ).then((out) => out as { token: string });
      set({ shareTokens: { ...get().shareTokens, [id]: token } });
      return token;
    },

    unshare: async (id) => {
      await api(`/api/dashboards/${id}/share`, { method: "DELETE" });
      set({ shareTokens: { ...get().shareTokens, [id]: null } });
    },

    loadPublic: (dashboard, analyses) => {
      useAnalysesStore.getState().replace(analyses);
      set({
        hydrated: true,
        order: [dashboard.id],
        dashboards: { [dashboard.id]: dashboard },
        currentId: dashboard.id,
        selectedId: null,
        preview: true,
        dirty: false,
      });
    },

    addElement: (item, placement, props) => {
      const doc = get().current();
      if (!doc) return null;
      pushSnapshot(`add:${item.key}`);
      const element = createElement(item, {
        x: placement?.x,
        y: placement?.y,
        z: topLevelZ(doc.elements),
        existing: doc.elements,
        canvas: doc.canvas,
        props,
      });
      mutateCurrent((current) => ({
        ...current,
        elements: [...current.elements, element],
        updatedAt: Date.now(),
      }));
      set({ selectedId: element.id, historyKey: null });
      return element.id;
    },

    setCanvasSize: (size) => {
      const doc = get().current();
      if (!doc) return;
      const width = clamp(size.width, CANVAS_LIMITS.min.w, CANVAS_LIMITS.max.w);
      const height = clamp(size.height, CANVAS_LIMITS.min.h, CANVAS_LIMITS.max.h);
      if (width === doc.canvas.width && height === doc.canvas.height) return;
      pushSnapshot("canvas-size");
      const canvas = { ...doc.canvas, width, height };
      mutateCurrent((current) => ({
        ...current,
        canvas,
        elements: current.elements.map((el) => {
          const min = ELEMENT_MIN[el.type];
          const w = clamp(el.w, min.w, Math.max(min.w, width));
          const h = clamp(el.h, min.h, Math.max(min.h, height));
          return { ...el, w, h, ...clampPosition({ ...el, w, h }, canvas) } as DashboardElement;
        }),
        updatedAt: Date.now(),
      }));
      set({ historyKey: null });
    },

    discardChanges: () => {
      const { currentId } = get();
      if (!currentId) return;
      // volta à última versão salva
      const { baseline } = get();
      if (baseline && baseline.id === currentId) {
        set({ dashboards: { ...get().dashboards, [currentId]: clone(baseline) } });
      }
      set({ dirty: false, past: [], future: [], historyKey: null, selectedId: null, saveError: null });
    },

    updateProps: (id, patch, field = "props") => {
      pushSnapshot(`props:${id}:${field}`);
      mutateCurrent((doc) => ({
        ...doc,
        elements: doc.elements.map((el) =>
          el.id === id ? ({ ...el, props: { ...el.props, ...patch } } as DashboardElement) : el,
        ),
        updatedAt: Date.now(),
      }));
    },

    patchElement: (id, patch, options) => {
      if (options?.transaction) pushSnapshot(options.transaction);
      mutateCurrent((doc) => ({
        ...doc,
        elements: doc.elements.map((el) => {
          if (el.id !== id) return el;
          const next = { ...el, ...patch } as DashboardElement;
          return { ...next, ...clampPosition(next, doc.canvas) };
        }),
        updatedAt: Date.now(),
      }));
    },

    moveElementTo: (id, x, y) => {
      mutateCurrent((doc) => ({
        ...doc,
        elements: doc.elements.map((el) => {
          if (el.id !== id) return el;
          return {
            ...el,
            ...clampPosition({ ...el, x, y }, doc.canvas),
          } as DashboardElement;
        }),
        updatedAt: Date.now(),
      }));
    },

    resizeElementTo: (id, size) => {
      mutateCurrent((doc) => {
        const target = doc.elements.find((el) => el.id === id);
        if (!target) return doc;

        const min = ELEMENT_MIN[target.type];
        const x = clamp(size.x ?? target.x, 0, doc.canvas.width);
        const y = clamp(size.y ?? target.y, 0, doc.canvas.height);
        const w = clamp(size.w, min.w, Math.max(min.w, doc.canvas.width - x));
        const h = clamp(size.h, min.h, Math.max(min.h, doc.canvas.height - y));
        const position = clampPosition({ x, y, w, h }, doc.canvas);

        return {
          ...doc,
          elements: doc.elements.map((el) =>
            el.id === id ? ({ ...el, w, h, ...position } as DashboardElement) : el,
          ),
          updatedAt: Date.now(),
        };
      });
    },

    nudge: (id, dx, dy) => {
      pushSnapshot(`move:${id}`);
      mutateCurrent((doc) => ({
        ...doc,
        elements: doc.elements.map((el) => {
          if (el.id !== id) return el;
          return {
            ...el,
            ...clampPosition({ ...el, x: el.x + dx, y: el.y + dy }, doc.canvas),
          } as DashboardElement;
        }),
        updatedAt: Date.now(),
      }));
    },

    duplicateElement: (id) => {
      const doc = get().current();
      if (!doc) return;
      const source = doc.elements.find((el) => el.id === id);
      if (!source) return;
      pushSnapshot(`dup:${id}`);
      const copy = {
        ...clone(source),
        id: uid(source.type),
        x: clamp(source.x + 24, 0, Math.max(0, doc.canvas.width - source.w)),
        y: clamp(source.y + 24, 0, Math.max(0, doc.canvas.height - source.h)),
        z: topLevelZ(doc.elements),
        hidden: false,
      } as DashboardElement;
      mutateCurrent((current) => ({
        ...current,
        elements: [...current.elements, copy],
        updatedAt: Date.now(),
      }));
      set({ selectedId: copy.id, historyKey: null });
    },

    removeElement: (id) => {
      pushSnapshot(`remove:${id}`);
      mutateCurrent((doc) => ({
        ...doc,
        elements: reindexLayers(doc.elements.filter((el) => el.id !== id)),
        updatedAt: Date.now(),
      }));
      set({
        selectedId: get().selectedId === id ? null : get().selectedId,
        historyKey: null,
      });
    },

    setHidden: (id, hidden) => {
      pushSnapshot(`hidden:${id}`);
      mutateCurrent((doc) => ({
        ...doc,
        elements: doc.elements.map((el) =>
          el.id === id ? ({ ...el, hidden } as DashboardElement) : el,
        ),
        updatedAt: Date.now(),
      }));
      set({ historyKey: null });
    },

    moveLayer: (id, direction) => {
      const doc = get().current();
      if (!doc) return;
      const sorted = [...doc.elements].sort(byZ);
      const index = sorted.findIndex((el) => el.id === id);
      if (index < 0) return;

      pushSnapshot(`layer:${id}:${direction}`);
      let next = [...sorted];

      if (direction === "front") {
        const [moved] = next.splice(index, 1);
        next.push(moved);
      } else if (direction === "back") {
        const [moved] = next.splice(index, 1);
        next.unshift(moved);
      } else {
        const target = direction === "up" ? index + 1 : index - 1;
        if (target < 0 || target >= next.length) {
          set({ historyKey: null });
          return;
        }
        [next[index], next[target]] = [next[target], next[index]];
      }

      const reindexed = reindexLayers(next);
      mutateCurrent((current) => ({
        ...current,
        elements: reindexed,
        updatedAt: Date.now(),
      }));
      set({ historyKey: null });
    },
  };
});
