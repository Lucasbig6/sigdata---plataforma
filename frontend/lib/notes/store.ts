/**
 * Notas do projeto (/api/projects/:id/notes): respostas do chat ou textos fixados para consulta
 * posterior. Mutações são otimistas, como nos demais stores.
 */
import { create } from "zustand";
import { api } from "@/lib/api/client";

export type ProjectNote = {
  id: string;
  title: string;
  body: string;
  resultId: string | null;
  createdAt: number;
  updatedAt: number;
};

type NotesStore = {
  notesByNotebook: Record<string, ProjectNote[]>;
  loaded: Record<string, boolean>;
  loadErrors: Record<string, string>;
  load: (notebookId: string) => Promise<void>;
  add: (notebookId: string, input: { title?: string; body: string; resultId?: string | null }) => Promise<ProjectNote>;
  update: (notebookId: string, id: string, patch: { title?: string; body?: string }) => Promise<void>;
  remove: (notebookId: string, id: string) => Promise<void>;
};

const loading = new Map<string, Promise<void>>();

export const useNotesStore = create<NotesStore>((set, get) => {
  const setNotes = (notebookId: string, notes: ProjectNote[]) =>
    set({ notesByNotebook: { ...get().notesByNotebook, [notebookId]: notes } });

  return {
    notesByNotebook: {},
    loaded: {},
    loadErrors: {},

    load: (notebookId) => {
      if (get().loaded[notebookId]) return Promise.resolve();
      const pending = loading.get(notebookId);
      if (pending) return pending;
      const { [notebookId]: _cleared, ...restErrors } = get().loadErrors;
      set({ loadErrors: restErrors });
      const request = api<ProjectNote[]>(`/api/projects/${notebookId}/notes`)
        .then((notes) => {
          set({ loaded: { ...get().loaded, [notebookId]: true } });
          setNotes(notebookId, notes);
        })
        .catch((error: Error) => set({ loadErrors: { ...get().loadErrors, [notebookId]: error.message } }))
        .finally(() => loading.delete(notebookId));
      loading.set(notebookId, request);
      return request;
    },

    add: async (notebookId, input) => {
      const note = await api<ProjectNote>(`/api/projects/${notebookId}/notes`, {
        method: "POST",
        json: { title: input.title ?? "", body: input.body, resultId: input.resultId ?? null },
      });
      setNotes(notebookId, [note, ...(get().notesByNotebook[notebookId] ?? [])]);
      return note;
    },

    update: async (notebookId, id, patch) => {
      const updated = await api<ProjectNote>(`/api/projects/${notebookId}/notes/${id}`, { method: "PATCH", json: patch });
      setNotes(
        notebookId,
        (get().notesByNotebook[notebookId] ?? []).map((note) => (note.id === id ? updated : note)),
      );
    },

    remove: async (notebookId, id) => {
      await api(`/api/projects/${notebookId}/notes/${id}`, { method: "DELETE" });
      setNotes(
        notebookId,
        (get().notesByNotebook[notebookId] ?? []).filter((note) => note.id !== id),
      );
    },
  };
});
