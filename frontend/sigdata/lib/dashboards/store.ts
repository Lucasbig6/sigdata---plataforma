/**
 * Estado do editor de dashboards SIGDATA.
 *
 * - Coleção de dashboards persistida em localStorage (validada na leitura).
 * - Editor com histórico (desfazer/refazer) por snapshots.
 * - Alterações só vão para o storage no `save()` (daí o indicador de
 *   "alterações não salvas"). Criar/remover dashboards persiste na hora.
 */
import { create } from "zustand";
import { createDemoDashboards } from "./demo-dashboards";
import { createElement, type LibraryItem } from "./presets";
import {
  ELEMENT_MIN,
  clamp,
  clampPosition,
  migrateDashboard,
  reindexLayers,
  topLevelZ,
  uid,
  type Dashboard,
  type DashboardElement,
} from "./types";

const STORAGE_KEY = "sigdata.dashboards.v1";
const HISTORY_LIMIT = 80;
const HISTORY_COALESCE_MS = 700;

type HistoryKey = string | null;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

type Collection = { order: string[]; byId: Record<string, Dashboard> };

const readCollection = (): Collection | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const { order, byId } = parsed as { order?: unknown; byId?: unknown };
    if (!Array.isArray(order) || typeof byId !== "object" || byId === null) return null;

    const validOrder: string[] = [];
    const validById: Record<string, Dashboard> = {};
    const source = byId as Record<string, unknown>;
    for (const id of order) {
      if (typeof id !== "string") continue;
      const dashboard = migrateDashboard(source[id]);
      if (!dashboard) continue;
      validOrder.push(dashboard.id);
      validById[dashboard.id] = dashboard;
    }
    return validOrder.length > 0 ? { order: validOrder, byId: validById } : null;
  } catch {
    return null;
  }
};

const writeCollection = (collection: Collection): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
  } catch {
    /* modo privado / storage indisponível */
  }
};

const byZ = (a: DashboardElement, b: DashboardElement) => a.z - b.z;

type SigdataDashboardsStore = {
  hydrated: boolean;
  order: string[];
  dashboards: Record<string, Dashboard>;

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
  save: () => void;

  addElement: (item: LibraryItem, placement?: { x?: number; y?: number }) => string | null;
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

const emptyCollection = (): Collection => {
  const demos = createDemoDashboards();
  return {
    order: demos.map((dashboard) => dashboard.id),
    byId: Object.fromEntries(demos.map((dashboard) => [dashboard.id, dashboard])),
  };
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
    order: [],
    dashboards: {},

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
      if (get().hydrated) return;
      const stored = readCollection();
      const collection = stored ?? emptyCollection();
      if (!stored) writeCollection(collection);
      set({
        hydrated: true,
        order: collection.order,
        dashboards: collection.byId,
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
        selectedId: null,
        preview: false,
        dirty: false,
        past: [],
        future: [],
        historyKey: null,
      });
      writeCollection({ order: next.order, byId: next.dashboards });
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
      writeCollection({ order: nextOrder, byId: nextDashboards });
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

    save: () => {
      const doc = get().current();
      if (!doc) return;
      const updated: Dashboard = { ...doc, updatedAt: Date.now() };
      const dashboards = { ...get().dashboards, [doc.id]: updated };
      set({
        dashboards,
        dirty: false,
        savedAt: Date.now(),
        past: [],
        future: [],
        historyKey: null,
      });
      writeCollection({ order: get().order, byId: dashboards });
    },

    addElement: (item, placement) => {
      const doc = get().current();
      if (!doc) return null;
      pushSnapshot(`add:${item.key}`);
      const element = createElement(item, {
        x: placement?.x,
        y: placement?.y,
        z: topLevelZ(doc.elements),
        existing: doc.elements,
      });
      mutateCurrent((current) => ({
        ...current,
        elements: [...current.elements, element],
        updatedAt: Date.now(),
      }));
      set({ selectedId: element.id, historyKey: null });
      return element.id;
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
