/**
 * Metadados dos notebooks (sessões de chat) da home SIGDATA.
 * Persiste apenas metadados em localStorage; as mensagens vivem no runtime do chat.
 */
import { create } from "zustand";

export type Notebook = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  coverIndex: number;
  sourceCount: number;
};

const STORAGE_KEY = "sigdata.notebooks.v1";

export const COVER_COUNT = 8;

export const DEFAULT_NOTEBOOK_TITLE = "Projeto sem título";

type Persisted = {
  notebooks?: Notebook[];
};

const readPersisted = (): Notebook[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Persisted;
    if (!Array.isArray(parsed.notebooks)) return [];
    return parsed.notebooks.filter(
      (notebook): notebook is Notebook =>
        typeof notebook === "object" &&
        notebook !== null &&
        typeof notebook.id === "string" &&
        typeof notebook.title === "string" &&
        typeof notebook.createdAt === "number" &&
        typeof notebook.updatedAt === "number" &&
        typeof notebook.coverIndex === "number" &&
        typeof notebook.sourceCount === "number",
    );
  } catch {
    return [];
  }
};

const persist = (notebooks: Notebook[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ notebooks }));
  } catch {
    /* modo privado / storage indisponível */
  }
};

const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `nb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type NotebooksStore = {
  hydrated: boolean;
  notebooks: Notebook[];

  hydrate: () => void;
  createNotebook: () => string;
  renameNotebook: (id: string, title: string) => void;
  touchNotebook: (id: string, patch?: { title?: string; sourceCount?: number }) => void;
  deleteNotebook: (id: string) => void;
};

export const useNotebooksStore = create<NotebooksStore>((set, get) => ({
  hydrated: false,
  notebooks: [],

  hydrate: () => {
    if (get().hydrated) return;
    set({ hydrated: true, notebooks: readPersisted() });
  },

  createNotebook: () => {
    const now = Date.now();
    const notebook: Notebook = {
      id: uid(),
      title: DEFAULT_NOTEBOOK_TITLE,
      createdAt: now,
      updatedAt: now,
      coverIndex: Math.floor(Math.random() * COVER_COUNT),
      sourceCount: 0,
    };
    const notebooks = [notebook, ...get().notebooks];
    set({ notebooks });
    persist(notebooks);
    return notebook.id;
  },

  renameNotebook: (id, title) => {
    const trimmed = title.trim() || DEFAULT_NOTEBOOK_TITLE;
    const notebooks = get().notebooks.map((notebook) =>
      notebook.id === id ? { ...notebook, title: trimmed, updatedAt: Date.now() } : notebook,
    );
    set({ notebooks });
    persist(notebooks);
  },

  touchNotebook: (id, patch) => {
    if (!get().notebooks.some((notebook) => notebook.id === id)) return;
    const notebooks = get().notebooks.map((notebook) =>
      notebook.id === id ? { ...notebook, ...patch, updatedAt: Date.now() } : notebook,
    );
    set({ notebooks });
    persist(notebooks);
  },

  deleteNotebook: (id) => {
    const notebooks = get().notebooks.filter((notebook) => notebook.id !== id);
    set({ notebooks });
    persist(notebooks);
  },
}));
