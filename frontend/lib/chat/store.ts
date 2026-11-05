/**
 * Conversas de cada projeto e o histórico da conversa aberta.
 * O servidor é a fonte da verdade: /api/chat grava a conversa ao fim de cada resposta;
 * aqui listamos as conversas do projeto e carregamos as mensagens ao abrir uma.
 * Mutações das conversas são otimistas, como as dos projetos.
 */
import type { UIMessage } from "ai";
import { create } from "zustand";
import { api, ApiError, background } from "@/lib/api/client";
import { DEFAULT_CHAT_TITLE, type Chat } from "@shared/notebook";

export { DEFAULT_CHAT_TITLE } from "@shared/notebook";
export type { Chat } from "@shared/notebook";

type LoadState = { status: "loading" } | { status: "ready" } | { status: "error"; error: string };

type ChatStore = {
  /** Conversas por projeto, da mais recente para a mais antiga. */
  chatsByProject: Record<string, Chat[]>;
  chatsState: Record<string, LoadState>;
  messagesByChat: Record<string, UIMessage[]>;
  messagesState: Record<string, LoadState>;

  loadChats: (projectId: string) => Promise<void>;
  /** Cria a conversa (a menos que já exista uma vazia, que é reaproveitada) e devolve o id. */
  createChat: (projectId: string) => string;
  renameChat: (projectId: string, chatId: string, title: string) => void;
  /** A conversa recebeu mensagens: sobe na lista e, na primeira pergunta, ganha o título dela. */
  touchChat: (projectId: string, chatId: string, title?: string) => void;
  deleteChat: (projectId: string, chatId: string) => void;
  loadMessages: (projectId: string, chatId: string) => Promise<void>;
  forgetMessages: (chatId: string) => void;
  clearProject: (projectId: string) => void;
};

/** Criações ainda não confirmadas pelo servidor (PATCH/DELETE precisam esperar o POST). */
const pendingCreates = new Map<string, Promise<unknown>>();
const afterCreate = (id: string, fn: () => Promise<unknown>) =>
  (pendingCreates.get(id) ?? Promise.resolve()).then(fn);

export const useChatStore = create<ChatStore>((set, get) => {
  const setChats = (projectId: string, update: (chats: Chat[]) => Chat[]) =>
    set({ chatsByProject: { ...get().chatsByProject, [projectId]: update(get().chatsByProject[projectId] ?? []) } });

  return {
    chatsByProject: {},
    chatsState: {},
    messagesByChat: {},
    messagesState: {},

    loadChats: async (projectId) => {
      if (get().chatsState[projectId]?.status === "loading") return;
      set({ chatsState: { ...get().chatsState, [projectId]: { status: "loading" } } });
      try {
        // 404 = projeto recém-criado cujo POST ainda não chegou: sem conversas
        const chats = await api<Chat[]>(`/api/projects/${projectId}/chats`).catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 404) return [];
          throw error;
        });
        // conversas criadas aqui e ainda não confirmadas não podem sumir da lista
        const local = (get().chatsByProject[projectId] ?? []).filter(
          (chat) => pendingCreates.has(chat.id) && !chats.some((entry) => entry.id === chat.id),
        );
        set({
          chatsByProject: { ...get().chatsByProject, [projectId]: [...local, ...chats] },
          chatsState: { ...get().chatsState, [projectId]: { status: "ready" } },
        });
      } catch (error) {
        set({
          chatsState: { ...get().chatsState, [projectId]: { status: "error", error: (error as Error).message } },
        });
      }
    },

    createChat: (projectId) => {
      const empty = (get().chatsByProject[projectId] ?? []).find((chat) => chat.title === DEFAULT_CHAT_TITLE);
      if (empty) return empty.id;
      const now = Date.now();
      const chat: Chat = { id: crypto.randomUUID(), projectId, title: DEFAULT_CHAT_TITLE, createdAt: now, updatedAt: now };
      setChats(projectId, (chats) => [chat, ...chats]);
      const request = api<Chat>(`/api/projects/${projectId}/chats`, { method: "POST", json: { id: chat.id } }).finally(
        () => pendingCreates.delete(chat.id),
      );
      pendingCreates.set(chat.id, request);
      background(request, "criar conversa");
      return chat.id;
    },

    renameChat: (projectId, chatId, title) => {
      const trimmed = title.trim() || DEFAULT_CHAT_TITLE;
      setChats(projectId, (chats) => chats.map((chat) => (chat.id === chatId ? { ...chat, title: trimmed } : chat)));
      background(
        afterCreate(chatId, () =>
          api(`/api/projects/${projectId}/chats/${chatId}`, { method: "PATCH", json: { title: trimmed } }),
        ),
        "renomear conversa",
      );
    },

    touchChat: (projectId, chatId, title) =>
      setChats(projectId, (chats) => {
        const current = chats.find((chat) => chat.id === chatId);
        if (!current) return chats;
        const next = {
          ...current,
          updatedAt: Date.now(),
          ...(title && current.title === DEFAULT_CHAT_TITLE && { title }),
        };
        return [next, ...chats.filter((chat) => chat.id !== chatId)];
      }),

    deleteChat: (projectId, chatId) => {
      setChats(projectId, (chats) => chats.filter((chat) => chat.id !== chatId));
      get().forgetMessages(chatId);
      background(
        afterCreate(chatId, () => api(`/api/projects/${projectId}/chats/${chatId}`, { method: "DELETE" })),
        "excluir conversa",
      );
    },

    loadMessages: async (projectId, chatId) => {
      if (get().messagesState[chatId]?.status === "loading") return;
      set({ messagesState: { ...get().messagesState, [chatId]: { status: "loading" } } });
      try {
        // 404 = conversa recém-criada cujo POST ainda não chegou: começa vazia
        const messages = await (pendingCreates.get(chatId) ?? Promise.resolve())
          .catch(() => undefined)
          .then(() => api<UIMessage[]>(`/api/projects/${projectId}/chats/${chatId}/messages`))
          .catch((error: unknown) => {
            if (error instanceof ApiError && error.status === 404) return [];
            throw error;
          });
        set({
          messagesByChat: { ...get().messagesByChat, [chatId]: messages },
          messagesState: { ...get().messagesState, [chatId]: { status: "ready" } },
        });
      } catch (error) {
        set({
          messagesState: { ...get().messagesState, [chatId]: { status: "error", error: (error as Error).message } },
        });
      }
    },

    forgetMessages: (chatId) => {
      const messagesByChat = { ...get().messagesByChat };
      const messagesState = { ...get().messagesState };
      delete messagesByChat[chatId];
      delete messagesState[chatId];
      set({ messagesByChat, messagesState });
    },

    clearProject: (projectId) => {
      for (const chat of get().chatsByProject[projectId] ?? []) get().forgetMessages(chat.id);
      const chatsByProject = { ...get().chatsByProject };
      const chatsState = { ...get().chatsState };
      delete chatsByProject[projectId];
      delete chatsState[projectId];
      set({ chatsByProject, chatsState });
    },
  };
});
