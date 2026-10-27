/**
 * Projetos (notebooks) do usuário, persistidos no backend (/api/projects).
 * Mutações são otimistas: a interface atualiza na hora e a API grava em seguida.
 */
import { create } from "zustand";
import { api, background } from "@/lib/api/client";
import { useChatStore } from "@/lib/chat/store";
import { usePanelStore } from "@/lib/panel/store";
import { COVER_COUNT, DEFAULT_NOTEBOOK_TITLE, type Notebook } from "@shared/notebook";

export type { Notebook } from "@shared/notebook";
export { COVER_COUNT, DEFAULT_NOTEBOOK_TITLE } from "@shared/notebook";

type NotebooksStore = {
  hydrated: boolean;
  error: string | null;
  notebooks: Notebook[];

  hydrate: () => void;
  createNotebook: (title?: string) => string;
  renameNotebook: (id: string, title: string) => void;
  touchNotebook: (id: string, patch?: { title?: string }) => void;
  setNotebookSource: (id: string, sourceId: string | null) => void;
  deleteNotebook: (id: string) => void;
};

let hydrating: Promise<void> | null = null;
/** Criações ainda não confirmadas pelo servidor (PATCH precisa esperar o POST). */
const pendingCreates = new Map<string, Promise<unknown>>();

const afterCreate = (id: string, fn: () => Promise<unknown>) =>
  (pendingCreates.get(id) ?? Promise.resolve()).then(fn);

export const useNotebooksStore = create<NotebooksStore>((set, get) => {
  const patchLocal = (id: string, patch: Partial<Notebook>) =>
    set({
      notebooks: get().notebooks.map((notebook) =>
        notebook.id === id ? { ...notebook, ...patch, updatedAt: Date.now() } : notebook,
      ),
    });

  return {
    hydrated: false,
    error: null,
    notebooks: [],

    hydrate: () => {
      if (get().hydrated || hydrating) return;
      hydrating = api<Notebook[]>("/api/projects")
        .then((notebooks) => set({ hydrated: true, notebooks, error: null }))
        .catch((error: Error) => set({ hydrated: true, error: error.message }))
        .finally(() => {
          hydrating = null;
        });
    },

    createNotebook: (title) => {
      const now = Date.now();
      const notebook: Notebook = {
        id: crypto.randomUUID(),
        title: title?.trim() || DEFAULT_NOTEBOOK_TITLE,
        createdAt: now,
        updatedAt: now,
        coverIndex: Math.floor(Math.random() * COVER_COUNT),
        sourceCount: 0,
        sourceId: null,
      };
      set({ notebooks: [notebook, ...get().notebooks] });
      const request = api<Notebook>("/api/projects", {
        method: "POST",
        json: { id: notebook.id, title: notebook.title, coverIndex: notebook.coverIndex },
      }).finally(() => pendingCreates.delete(notebook.id));
      pendingCreates.set(notebook.id, request);
      background(request, "criar projeto");
      return notebook.id;
    },

    renameNotebook: (id, title) => {
      const trimmed = title.trim() || DEFAULT_NOTEBOOK_TITLE;
      patchLocal(id, { title: trimmed });
      background(
        afterCreate(id, () => api(`/api/projects/${id}`, { method: "PATCH", json: { title: trimmed } })),
        "renomear projeto",
      );
    },

    touchNotebook: (id, patch) => {
      if (!get().notebooks.some((notebook) => notebook.id === id)) return;
      patchLocal(id, patch ?? {});
      if (patch?.title !== undefined) {
        background(
          afterCreate(id, () =>
            api(`/api/projects/${id}`, { method: "PATCH", json: { title: patch.title } }),
          ),
          "atualizar projeto",
        );
      }
    },

    setNotebookSource: (id, sourceId) => {
      patchLocal(id, { sourceId, sourceCount: sourceId ? 1 : 0 });
      background(
        afterCreate(id, () => api(`/api/projects/${id}`, { method: "PATCH", json: { sourceId } })),
        "trocar fonte do projeto",
      );
    },

    deleteNotebook: (id) => {
      set({ notebooks: get().notebooks.filter((notebook) => notebook.id !== id) });
      useChatStore.getState().clearNotebook(id);
      usePanelStore.getState().clearNotebook(id);
      background(
        afterCreate(id, () => api(`/api/projects/${id}`, { method: "DELETE" })),
        "excluir projeto",
      );
    },
  };
});
