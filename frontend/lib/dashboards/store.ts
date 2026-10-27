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
import {
  NO_GUIDES,
  alignElements,
  autoArrange,
  boundsOf,
  distributeElements,
  matchSize,
  snapMove,
  type AlignMode,
  type Guides,
} from "./layout-ops";
import {
  appendPage,
  duplicatePage,
  firstPageId,
  goToPage,
  movePage,
  removePage,
  renamePage,
  syncActive,
  toPersisted,
} from "./pages";
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
  type DashboardMeasure,
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

const toPayload = (doc: Dashboard, activePageId: string | null = null) => {
  const persisted = toPersisted(doc, activePageId);
  return {
    id: persisted.id,
    schemaVersion: persisted.schemaVersion,
    name: persisted.name,
    description: persisted.description,
    origin: persisted.origin,
    createdAt: persisted.createdAt,
    updatedAt: persisted.updatedAt,
    canvas: persisted.canvas,
    elements: persisted.elements,
    ...(persisted.pages && { pages: persisted.pages }),
    ...(persisted.measures && { measures: persisted.measures }),
  };
};

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
  /** Elemento selecionado quando é exatamente um; senão null (ver `selectedIds`). */
  selectedId: string | null;
  selectedIds: string[];
  /** Linhas guia de alinhamento durante o arrasto (não faz parte do documento). */
  guides: Guides;
  autosave: boolean;
  setAutosave: (value: boolean) => void;
  /** Página aberta (null = painel de uma página só). */
  activePageId: string | null;
  switchPage: (id: string) => void;
  addPage: () => void;
  duplicatePage: (id: string) => void;
  deletePage: (id: string) => void;
  renamePage: (id: string, name: string) => void;
  movePage: (id: string, direction: -1 | 1) => void;
  /** Medidas calculadas reutilizáveis do painel. */
  addMeasure: (measure: Omit<DashboardMeasure, "id">) => string;
  updateMeasure: (id: string, patch: Partial<Omit<DashboardMeasure, "id">>) => void;
  removeMeasure: (id: string) => void;
  /** Troca o documento aberto por uma versão devolvida pelo servidor (ex.: restaurar histórico). */
  replaceFromServer: (dashboard: Dashboard) => void;
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
  /** Cor de fundo da página (`null` volta ao padrão do tema). */
  setCanvasBackground: (background: string | null) => void;
  /** Fonte usada por elementos novos (preferência do editor; "" = automática). */
  preferredSourceId: string;
  setPreferredSourceId: (id: string) => void;
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

  /* seleção múltipla, grupos e organização */
  selectMany: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  /** Mantém a seleção se o elemento já faz parte dela (arrasto em grupo). */
  selectForDrag: (id: string) => void;
  dragSelection: (primaryId: string, x: number, y: number, threshold: number) => void;
  moveSelected: (dx: number, dy: number) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  setHiddenSelected: (hidden: boolean) => void;
  alignSelected: (mode: AlignMode) => void;
  distributeSelected: (axis: "horizontal" | "vertical") => void;
  matchSelectedSize: (dimension: "w" | "h") => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  arrange: () => void;
  copySelected: () => boolean;
  cutSelected: () => void;
  paste: () => void;
  /** Adiciona elementos já montados (modelos de página). */
  addElements: (elements: DashboardElement[]) => void;
  setCanvasPalette: (palette: string[] | null) => void;
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

const CLIPBOARD_KEY = "sigdata.clipboard.v1";
let clipboard: { elements: DashboardElement[]; pastes: number } | null = null;

const readClipboard = () => {
  if (clipboard) return clipboard;
  try {
    const raw = JSON.parse(window.localStorage.getItem(CLIPBOARD_KEY) ?? "null") as unknown;
    if (Array.isArray(raw) && raw.length > 0) clipboard = { elements: raw as DashboardElement[], pastes: 0 };
  } catch {
    /* área de transferência é opcional */
  }
  return clipboard;
};

const writeClipboard = (elements: DashboardElement[]) => {
  clipboard = { elements, pastes: 0 };
  try {
    window.localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(elements));
  } catch {
    /* só nesta aba */
  }
};

export const useDashboardsStore = create<SigdataDashboardsStore>((rawSet, get) => {
  // `selectedId` (um só) e `selectedIds` (vários) andam juntos: quem muda um atualiza o outro
  const set: typeof rawSet = (patch, replace) =>
    rawSet((state) => {
      const next = typeof patch === "function" ? patch(state) : patch;
      if (next && "selectedId" in next && !("selectedIds" in next)) {
        return { ...next, selectedIds: next.selectedId ? [next.selectedId] : [] };
      }
      if (next && "selectedIds" in next && !("selectedId" in next)) {
        const ids = next.selectedIds ?? [];
        return { ...next, selectedId: ids.length === 1 ? ids[0] : null };
      }
      return next;
    }, replace as false | undefined);

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

    preferredSourceId: "",
    setPreferredSourceId: (id) => set({ preferredSourceId: id }),

    currentId: null,
    selectedId: null,
    selectedIds: [],
    activePageId: null,
    guides: NO_GUIDES,
    autosave: readPref("autosave", false),
    setAutosave: (value) => {
      writePref("autosave", value);
      set({ autosave: value });
    },
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

    select: (id) => {
      if (id === null) return set({ selectedIds: [] });
      const doc = get().current();
      const group = doc?.elements.find((el) => el.id === id)?.groupId;
      const members = group ? (doc?.elements ?? []).filter((el) => el.groupId === group).map((el) => el.id) : [id];
      set({ selectedIds: members });
    },
    setPreview: (preview) =>
      set(preview ? { preview: true, selectedId: null } : { preview: false }),

    openDashboard: (id) =>
      set({
        baseline: id && get().dashboards[id] ? clone(get().dashboards[id]) : null,
        activePageId: id ? firstPageId(get().dashboards[id]) : null,
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
        activePageId: null,
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
    endTransaction: () => set({ historyKey: null, guides: NO_GUIDES }),

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
        // a seleção só mantém o que ainda existe depois de desfazer
        selectedIds: get().selectedIds.filter((id) => previous.elements.some((el) => el.id === id)),
        guides: NO_GUIDES,
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
        selectedIds: get().selectedIds.filter((id) => next.elements.some((el) => el.id === id)),
        guides: NO_GUIDES,
      });
    },

    save: async () => {
      const doc = get().current();
      if (!doc) return;
      const updated: Dashboard = syncActive({ ...doc, updatedAt: Date.now() }, get().activePageId);
      set({
        dashboards: { ...get().dashboards, [doc.id]: updated },
        saving: true,
        saveError: null,
      });
      try {
        await afterCreate(doc.id, () =>
          api(`/api/dashboards/${doc.id}`, { method: "PUT", json: toPayload(updated, get().activePageId) }),
        );
        // só limpa o "não salvo" se nada mudou durante a requisição
        const stillSame = get().dashboards[doc.id] === updated;
        set({
          saving: false,
          savedAt: Date.now(),
          baseline: clone(toPersisted(updated, get().activePageId)),
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
        activePageId: firstPageId(dashboard),
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

    setCanvasBackground: (background) => {
      const doc = get().current();
      if (!doc || (doc.canvas.background ?? null) === background) return;
      pushSnapshot("canvas-background");
      mutateCurrent((current) => {
        const { background: _old, ...rest } = current.canvas;
        return {
          ...current,
          canvas: background ? { ...rest, background } : rest,
          updatedAt: Date.now(),
        };
      });
    },

    discardChanges: () => {
      const { currentId } = get();
      if (!currentId) return;
      // volta à última versão salva
      const { baseline } = get();
      if (baseline && baseline.id === currentId) {
        set({ dashboards: { ...get().dashboards, [currentId]: clone(baseline) }, activePageId: firstPageId(baseline) });
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

    selectMany: (ids) => {
      const doc = get().current();
      if (!doc) return;
      const groups = new Set(doc.elements.filter((el) => ids.includes(el.id) && el.groupId).map((el) => el.groupId));
      const expanded = doc.elements
        .filter((el) => ids.includes(el.id) || (el.groupId && groups.has(el.groupId)))
        .map((el) => el.id);
      set({ selectedIds: expanded });
    },

    toggleSelect: (id) => {
      const { selectedIds } = get();
      const doc = get().current();
      const group = doc?.elements.find((el) => el.id === id)?.groupId;
      const members = group ? (doc?.elements ?? []).filter((el) => el.groupId === group).map((el) => el.id) : [id];
      const on = members.every((member) => selectedIds.includes(member));
      set({
        selectedIds: on
          ? selectedIds.filter((entry) => !members.includes(entry))
          : [...new Set([...selectedIds, ...members])],
      });
    },

    selectAll: () => {
      const doc = get().current();
      if (doc) set({ selectedIds: doc.elements.filter((el) => !el.hidden).map((el) => el.id) });
    },

    selectForDrag: (id) => {
      if (!get().selectedIds.includes(id)) get().select(id);
    },

    dragSelection: (primaryId, x, y, threshold) => {
      const doc = get().current();
      if (!doc) return;
      const primary = doc.elements.find((el) => el.id === primaryId);
      if (!primary) return;
      const ids = get().selectedIds.includes(primaryId) ? get().selectedIds : [primaryId];
      const moving = doc.elements.filter((el) => ids.includes(el.id));
      const box = boundsOf(moving);

      // deslocamento pedido pelo mouse, limitado à página
      let dx = x - primary.x;
      let dy = y - primary.y;
      dx = clamp(box.x + dx, 0, Math.max(0, doc.canvas.width - box.w)) - box.x;
      dy = clamp(box.y + dy, 0, Math.max(0, doc.canvas.height - box.h)) - box.y;

      // guias de alinhamento com os outros elementos e com a página
      const others = doc.elements.filter((el) => !ids.includes(el.id) && !el.hidden);
      const snap = snapMove({ ...box, x: box.x + dx, y: box.y + dy }, others, doc.canvas, threshold);
      dx += snap.dx;
      dy += snap.dy;
      dx = clamp(box.x + dx, 0, Math.max(0, doc.canvas.width - box.w)) - box.x;
      dy = clamp(box.y + dy, 0, Math.max(0, doc.canvas.height - box.h)) - box.y;

      mutateCurrent((current) => ({
        ...current,
        elements: current.elements.map((el) =>
          ids.includes(el.id) ? ({ ...el, x: el.x + dx, y: el.y + dy } as DashboardElement) : el,
        ),
        updatedAt: Date.now(),
      }));
      set({ guides: snap.guides });
    },

    moveSelected: (dx, dy) => {
      const ids = get().selectedIds;
      const doc = get().current();
      if (!doc || ids.length === 0) return;
      pushSnapshot(`move:${ids.join(",")}`);
      const box = boundsOf(doc.elements.filter((el) => ids.includes(el.id)));
      const mx = clamp(box.x + dx, 0, Math.max(0, doc.canvas.width - box.w)) - box.x;
      const my = clamp(box.y + dy, 0, Math.max(0, doc.canvas.height - box.h)) - box.y;
      mutateCurrent((current) => ({
        ...current,
        elements: current.elements.map((el) =>
          ids.includes(el.id) ? ({ ...el, x: el.x + mx, y: el.y + my } as DashboardElement) : el,
        ),
        updatedAt: Date.now(),
      }));
    },

    removeSelected: () => {
      const ids = get().selectedIds;
      if (ids.length === 0) return;
      pushSnapshot(`remove:${ids.join(",")}`);
      mutateCurrent((doc) => ({
        ...doc,
        elements: reindexLayers(doc.elements.filter((el) => !ids.includes(el.id))),
        updatedAt: Date.now(),
      }));
      set({ selectedIds: [], historyKey: null });
    },

    duplicateSelected: () => {
      const doc = get().current();
      const ids = get().selectedIds;
      if (!doc || ids.length === 0) return;
      const sources = doc.elements.filter((el) => ids.includes(el.id)).sort(byZ);
      pushSnapshot(`dup:${ids.join(",")}`);
      const groupMap = new Map<string, string>();
      let z = topLevelZ(doc.elements);
      const copies = sources.map((source) => {
        const groupId = source.groupId ? (groupMap.get(source.groupId) ?? uid("grp")) : undefined;
        if (source.groupId && groupId) groupMap.set(source.groupId, groupId);
        return {
          ...clone(source),
          id: uid(source.type),
          x: clamp(source.x + 24, 0, Math.max(0, doc.canvas.width - source.w)),
          y: clamp(source.y + 24, 0, Math.max(0, doc.canvas.height - source.h)),
          z: z++,
          hidden: false,
          ...(groupId && { groupId }),
        } as DashboardElement;
      });
      mutateCurrent((current) => ({
        ...current,
        elements: [...current.elements, ...copies],
        updatedAt: Date.now(),
      }));
      set({ selectedIds: copies.map((el) => el.id), historyKey: null });
    },

    setHiddenSelected: (hidden) => {
      const ids = get().selectedIds;
      if (ids.length === 0) return;
      pushSnapshot(`hidden:${ids.join(",")}`);
      mutateCurrent((doc) => ({
        ...doc,
        elements: doc.elements.map((el) => (ids.includes(el.id) ? ({ ...el, hidden } as DashboardElement) : el)),
        updatedAt: Date.now(),
      }));
      set({ historyKey: null });
    },

    alignSelected: (mode) => {
      const ids = get().selectedIds;
      if (ids.length === 0) return;
      pushSnapshot(`align:${mode}`);
      mutateCurrent((doc) => ({
        ...doc,
        elements: alignElements(doc.elements, ids, mode, doc.canvas),
        updatedAt: Date.now(),
      }));
      set({ historyKey: null });
    },

    distributeSelected: (axis) => {
      const ids = get().selectedIds;
      if (ids.length < 3) return;
      pushSnapshot(`distribute:${axis}`);
      mutateCurrent((doc) => ({
        ...doc,
        elements: distributeElements(doc.elements, ids, axis, doc.canvas),
        updatedAt: Date.now(),
      }));
      set({ historyKey: null });
    },

    matchSelectedSize: (dimension) => {
      const ids = get().selectedIds;
      if (ids.length < 2) return;
      pushSnapshot(`match:${dimension}`);
      mutateCurrent((doc) => ({
        ...doc,
        elements: matchSize(doc.elements, ids, dimension, doc.canvas),
        updatedAt: Date.now(),
      }));
      set({ historyKey: null });
    },

    groupSelected: () => {
      const ids = get().selectedIds;
      if (ids.length < 2) return;
      const groupId = uid("grp");
      pushSnapshot("group");
      mutateCurrent((doc) => ({
        ...doc,
        elements: doc.elements.map((el) => (ids.includes(el.id) ? ({ ...el, groupId } as DashboardElement) : el)),
        updatedAt: Date.now(),
      }));
      set({ historyKey: null });
    },

    ungroupSelected: () => {
      const ids = get().selectedIds;
      if (ids.length === 0) return;
      pushSnapshot("ungroup");
      mutateCurrent((doc) => ({
        ...doc,
        elements: doc.elements.map((el) => {
          if (!ids.includes(el.id) || !el.groupId) return el;
          const { groupId: _gone, ...rest } = el;
          return rest as DashboardElement;
        }),
        updatedAt: Date.now(),
      }));
      set({ historyKey: null });
    },

    arrange: () => {
      const doc = get().current();
      if (!doc || doc.elements.length === 0) return;
      pushSnapshot("arrange");
      mutateCurrent((current) => {
        const out = autoArrange(current.elements, current.canvas);
        return {
          ...current,
          canvas: { ...current.canvas, height: Math.min(out.height, CANVAS_LIMITS.max.h) },
          elements: out.elements,
          updatedAt: Date.now(),
        };
      });
      set({ historyKey: null });
    },

    copySelected: () => {
      const doc = get().current();
      const ids = get().selectedIds;
      if (!doc || ids.length === 0) return false;
      writeClipboard(clone(doc.elements.filter((el) => ids.includes(el.id)).sort(byZ)));
      return true;
    },

    cutSelected: () => {
      if (get().copySelected()) get().removeSelected();
    },

    paste: () => {
      const doc = get().current();
      const board = readClipboard();
      if (!doc || !board || board.elements.length === 0) return;
      board.pastes += 1;
      const offset = 24 * board.pastes;
      pushSnapshot("paste");
      const groupMap = new Map<string, string>();
      let z = topLevelZ(doc.elements);
      const copies = board.elements.map((source) => {
        const groupId = source.groupId ? (groupMap.get(source.groupId) ?? uid("grp")) : undefined;
        if (source.groupId && groupId) groupMap.set(source.groupId, groupId);
        const w = Math.min(source.w, doc.canvas.width);
        const h = Math.min(source.h, doc.canvas.height);
        return {
          ...clone(source),
          id: uid(source.type),
          w,
          h,
          x: clamp(source.x + offset, 0, Math.max(0, doc.canvas.width - w)),
          y: clamp(source.y + offset, 0, Math.max(0, doc.canvas.height - h)),
          z: z++,
          hidden: false,
          ...(groupId ? { groupId } : { groupId: undefined }),
        } as DashboardElement;
      });
      mutateCurrent((current) => ({
        ...current,
        elements: [...current.elements, ...copies],
        updatedAt: Date.now(),
      }));
      set({ selectedIds: copies.map((el) => el.id), historyKey: null });
    },

    addElements: (incoming) => {
      const doc = get().current();
      if (!doc || incoming.length === 0) return;
      pushSnapshot("add-many");
      let z = topLevelZ(doc.elements);
      const placed = incoming.map((el) => ({ ...el, z: z++ }) as DashboardElement);
      mutateCurrent((current) => ({
        ...current,
        elements: [...current.elements, ...placed],
        updatedAt: Date.now(),
      }));
      set({ selectedIds: placed.map((el) => el.id), historyKey: null });
    },

    switchPage: (id) => {
      const { currentId, activePageId } = get();
      const doc = get().current();
      if (!currentId || !doc?.pages || id === (activePageId ?? doc.pages[0]?.id)) return;
      const next = goToPage(doc, activePageId, id);
      if (!next) return;
      // o histórico é por página: desfazer não atravessa páginas
      set({
        dashboards: { ...get().dashboards, [currentId]: next },
        activePageId: id,
        selectedIds: [],
        past: [],
        future: [],
        historyKey: null,
        guides: NO_GUIDES,
      });
    },

    addPage: () => {
      const { currentId, activePageId } = get();
      const doc = get().current();
      if (!currentId || !doc) return;
      const out = appendPage(doc, activePageId);
      if (!out) return;
      set({
        dashboards: { ...get().dashboards, [currentId]: { ...out.doc, updatedAt: Date.now() } },
        activePageId: out.activeId,
        selectedIds: [],
        past: [],
        future: [],
        historyKey: null,
        dirty: true,
      });
    },

    duplicatePage: (id) => {
      const { currentId, activePageId } = get();
      const doc = get().current();
      if (!currentId || !doc) return;
      const out = duplicatePage(doc, activePageId, id);
      if (!out) return;
      set({
        dashboards: { ...get().dashboards, [currentId]: { ...out.doc, updatedAt: Date.now() } },
        activePageId: out.activeId,
        selectedIds: [],
        past: [],
        future: [],
        historyKey: null,
        dirty: true,
      });
    },

    deletePage: (id) => {
      const { currentId, activePageId } = get();
      const doc = get().current();
      if (!currentId || !doc) return;
      const out = removePage(doc, activePageId, id);
      if (!out) return;
      set({
        dashboards: { ...get().dashboards, [currentId]: { ...out.doc, updatedAt: Date.now() } },
        activePageId: out.activeId,
        selectedIds: [],
        past: [],
        future: [],
        historyKey: null,
        dirty: true,
      });
    },

    renamePage: (id, name) => {
      const doc = get().current();
      if (!doc?.pages) return;
      pushSnapshot(`page-name:${id}`);
      mutateCurrent((current) => ({ ...renamePage(current, id, name), updatedAt: Date.now() }));
    },

    movePage: (id, direction) => {
      const doc = get().current();
      if (!doc?.pages) return;
      pushSnapshot("page-move");
      mutateCurrent((current) => ({ ...movePage(current, get().activePageId, id, direction), updatedAt: Date.now() }));
      set({ historyKey: null });
    },

    addMeasure: (measure) => {
      const id = uid("ms");
      pushSnapshot("measure-add");
      mutateCurrent((doc) => ({
        ...doc,
        measures: [...(doc.measures ?? []), { id, ...measure }],
        updatedAt: Date.now(),
      }));
      set({ historyKey: null });
      return id;
    },

    updateMeasure: (id, patch) => {
      const previous = get().current()?.measures?.find((m) => m.id === id);
      pushSnapshot(`measure:${id}`);
      // os elementos guardam uma cópia da medida: acompanham a edição
      const follow = (element: DashboardElement): DashboardElement => {
        const binding = (element.props as { binding?: { calc?: { name: string; expr: string }; sourceId?: string; table?: string } }).binding;
        if (
          !previous ||
          !binding?.calc ||
          binding.calc.name !== previous.name ||
          binding.calc.expr !== previous.expr ||
          binding.sourceId !== previous.sourceId ||
          binding.table !== previous.table
        ) {
          return element;
        }
        return {
          ...element,
          props: {
            ...element.props,
            binding: { ...binding, calc: { name: patch.name ?? previous.name, expr: patch.expr ?? previous.expr } },
          },
        } as DashboardElement;
      };
      mutateCurrent((doc) => ({
        ...doc,
        measures: (doc.measures ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m)),
        elements: doc.elements.map(follow),
        ...(doc.pages && { pages: doc.pages.map((page) => ({ ...page, elements: page.elements.map(follow) })) }),
        updatedAt: Date.now(),
      }));
    },

    removeMeasure: (id) => {
      pushSnapshot("measure-remove");
      mutateCurrent((doc) => {
        const measures = (doc.measures ?? []).filter((m) => m.id !== id);
        const { measures: _old, ...rest } = doc;
        return { ...(measures.length > 0 ? { ...doc, measures } : rest), updatedAt: Date.now() } as Dashboard;
      });
      set({ historyKey: null });
    },

    /** Métricas do dashboard atual (memoizada via store). */
    measures: (): DashboardMeasure[] => {
      const { currentId, dashboards } = get();
      return currentId ? (dashboards[currentId]?.measures ?? []) : [];
    },

    replaceFromServer: (dashboard) => {
      const { shareToken: _token, ...doc } = dashboard as Dashboard & { shareToken?: string | null };
      set({
        dashboards: { ...get().dashboards, [doc.id]: doc },
        baseline: clone(doc),
        activePageId: firstPageId(doc),
        dirty: false,
        past: [],
        future: [],
        historyKey: null,
        selectedIds: [],
        saveError: null,
      });
    },

    setCanvasPalette: (palette) => {
      const doc = get().current();
      if (!doc) return;
      pushSnapshot("canvas-palette");
      mutateCurrent((current) => {
        const { palette: _old, ...rest } = current.canvas;
        return {
          ...current,
          canvas: palette ? { ...rest, palette } : rest,
          updatedAt: Date.now(),
        };
      });
      set({ historyKey: null });
    },
  };
});
