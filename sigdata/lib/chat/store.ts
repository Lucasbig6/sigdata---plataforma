/**
 * Histórico de mensagens por projeto.
 * O servidor é a fonte da verdade: /api/chat grava a conversa ao fim de cada
 * resposta; aqui só carregamos o histórico ao abrir o projeto.
 */
import type { UIMessage } from "ai";
import { create } from "zustand";
import { api, ApiError } from "@/lib/api/client";

type LoadState = { status: "loading" } | { status: "ready" } | { status: "error"; error: string };

type ChatStore = {
  messagesByNotebook: Record<string, UIMessage[]>;
  loadState: Record<string, LoadState>;

  load: (notebookId: string) => Promise<void>;
  clearNotebook: (notebookId: string) => void;
};

export const useChatStore = create<ChatStore>((set, get) => ({
  messagesByNotebook: {},
  loadState: {},

  load: async (notebookId) => {
    if (get().loadState[notebookId]?.status === "loading") return;
    set({ loadState: { ...get().loadState, [notebookId]: { status: "loading" } } });
    try {
      // 404 = projeto recém-criado cujo POST ainda não chegou: começa vazio
      const messages = await api<UIMessage[]>(`/api/projects/${notebookId}/messages`).catch(
        (error: unknown) => {
          if (error instanceof ApiError && error.status === 404) return [];
          throw error;
        },
      );
      set({
        messagesByNotebook: { ...get().messagesByNotebook, [notebookId]: messages },
        loadState: { ...get().loadState, [notebookId]: { status: "ready" } },
      });
    } catch (error) {
      set({
        loadState: {
          ...get().loadState,
          [notebookId]: { status: "error", error: (error as Error).message },
        },
      });
    }
  },

  clearNotebook: (notebookId) => {
    const messagesByNotebook = { ...get().messagesByNotebook };
    const loadState = { ...get().loadState };
    delete messagesByNotebook[notebookId];
    delete loadState[notebookId];
    set({ messagesByNotebook, loadState });
  },
}));
