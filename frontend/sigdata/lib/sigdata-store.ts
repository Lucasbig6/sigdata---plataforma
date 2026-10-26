/**
 * Estado local do workspace SIGDATA.
 * Persiste apenas preferências de interface (nada sensível).
 */
import { create } from "zustand";

export type SigdataSection = "conversa" | "projetos";

export type DemoStatus = "idle" | "loading" | "ready" | "error";

export type PanelView = "todos" | "grafico" | "tabela" | "indicadores";

const STORAGE_KEY = "sigdata.workspace.v1";

type Persisted = {
  section?: SigdataSection;
  panelWidth?: number;
  panelCollapsed?: boolean;
};

const readPersisted = (): Persisted => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : {};
  } catch {
    return {};
  }
};

const persist = (data: Persisted) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* modo privado / storage indisponível */
  }
};

const SECTIONS: SigdataSection[] = ["conversa", "projetos"];

/** Valida a seção salva (entradas antigas, ex.: "paineis", caem em "conversa"). */
const safeSection = (value: unknown): SigdataSection =>
  SECTIONS.includes(value as SigdataSection) ? (value as SigdataSection) : "conversa";

export const PANEL_WIDTH_MIN = 320;
export const PANEL_WIDTH_MAX = 720;
export const PANEL_WIDTH_DEFAULT = 460;

export const clampPanelWidth = (px: number) =>
  Math.min(PANEL_WIDTH_MAX, Math.max(PANEL_WIDTH_MIN, Math.round(px)));

type SigdataStore = {
  section: SigdataSection;
  panelWidth: number;
  panelCollapsed: boolean;
  panelMobileOpen: boolean;
  panelView: PanelView;
  demoStatus: DemoStatus;
  savedAt: number | null;
  hydrated: boolean;

  setSection: (section: SigdataSection) => void;
  setPanelWidth: (px: number) => void;
  setPanelCollapsed: (collapsed: boolean) => void;
  togglePanelCollapsed: () => void;
  setPanelMobileOpen: (open: boolean) => void;
  setPanelView: (view: PanelView) => void;
  hydrate: () => void;
  loadDemo: () => void;
  savePreferences: () => void;
};

export const useSigdata = create<SigdataStore>((set, get) => ({
  section: "conversa",
  panelWidth: PANEL_WIDTH_DEFAULT,
  panelCollapsed: false,
  panelMobileOpen: false,
  panelView: "todos",
  demoStatus: "idle",
  savedAt: null,
  hydrated: false,

  setSection: (section) => set({ section }),
  setPanelWidth: (px) => set({ panelWidth: clampPanelWidth(px) }),
  setPanelCollapsed: (panelCollapsed) => set({ panelCollapsed }),
  togglePanelCollapsed: () => set((s) => ({ panelCollapsed: !s.panelCollapsed })),
  setPanelMobileOpen: (panelMobileOpen) => set({ panelMobileOpen }),
  setPanelView: (panelView) => set({ panelView }),

  hydrate: () => {
    if (get().hydrated) return;
    const persisted = readPersisted();
    set({
      hydrated: true,
      section: safeSection(persisted.section),
      panelWidth: clampPanelWidth(persisted.panelWidth ?? PANEL_WIDTH_DEFAULT),
      panelCollapsed: persisted.panelCollapsed ?? false,
    });
  },

  loadDemo: () => {
    if (get().demoStatus === "loading" || get().demoStatus === "ready") return;
    set({ demoStatus: "loading" });
    void import("@/lib/demo-data")
      .then(({ loadDemoData }) => loadDemoData())
      .then(() => set({ demoStatus: "ready" }))
      .catch(() => set({ demoStatus: "error" }));
  },

  savePreferences: () => {
    const { section, panelWidth, panelCollapsed } = get();
    persist({ section, panelWidth, panelCollapsed });
    set({ savedAt: Date.now() });
  },
}));
