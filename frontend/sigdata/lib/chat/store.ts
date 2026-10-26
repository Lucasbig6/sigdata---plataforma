/**
 * Mensagens de chat persistidas por notebook (conversa).
 * localStorage apenas; sem backend nesta etapa.
 */
import type { UIMessage } from "ai";
import { create } from "zustand";

const STORAGE_KEY = "sigdata.chat.v1";
const SAVE_DEBOUNCE_MS = 400;
const MAX_MESSAGES_PER_NOTEBOOK = 200;

type Persisted = {
  messagesByNotebook?: Record<string, UIMessage[]>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const sanitizeMessages = (raw: unknown): UIMessage[] => {
  if (!Array.isArray(raw)) return [];
  return raw.filter((message): message is UIMessage => {
    if (!isRecord(message)) return false;
    if (typeof message.id !== "string") return false;
    if (typeof message.role !== "string") return false;
    if (!Array.isArray(message.parts)) return false;
    return true;
  }) as UIMessage[];
};

const readPersisted = (): Record<string, UIMessage[]> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Persisted;
    if (!isRecord(parsed.messagesByNotebook)) return {};
    const result: Record<string, UIMessage[]> = {};
    for (const [notebookId, messages] of Object.entries(parsed.messagesByNotebook)) {
      const safe = sanitizeMessages(messages);
      if (safe.length > 0) result[notebookId] = safe;
    }
    return result;
  } catch {
    return {};
  }
};

const persist = (messagesByNotebook: Record<string, UIMessage[]>) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ messagesByNotebook }));
  } catch {
    /* modo privado / storage indisponível */
  }
};

type ChatStore = {
  hydrated: boolean;
  messagesByNotebook: Record<string, UIMessage[]>;

  hydrate: () => void;
  getMessages: (notebookId: string) => UIMessage[];
  saveMessages: (notebookId: string, messages: UIMessage[]) => void;
  clearNotebook: (notebookId: string) => void;
};

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useChatStore = create<ChatStore>((set, get) => ({
  hydrated: false,
  messagesByNotebook: {},

  hydrate: () => {
    if (get().hydrated) return;
    set({ hydrated: true, messagesByNotebook: readPersisted() });
  },

  getMessages: (notebookId) => get().messagesByNotebook[notebookId] ?? [],

  saveMessages: (notebookId, messages) => {
    if (!notebookId) return;
    const trimmed = messages.slice(-MAX_MESSAGES_PER_NOTEBOOK);
    const existing = get().messagesByNotebook[notebookId];
    if (JSON.stringify(existing) === JSON.stringify(trimmed)) return;

    const pending: Record<string, UIMessage[]> = { ...get().messagesByNotebook };
    pending[notebookId] = trimmed;
    set({ messagesByNotebook: pending });

    const previous = saveTimers.get(notebookId);
    if (previous) clearTimeout(previous);
    saveTimers.set(
      notebookId,
      setTimeout(() => {
        saveTimers.delete(notebookId);
        persist(get().messagesByNotebook);
      }, SAVE_DEBOUNCE_MS),
    );
  },

  clearNotebook: (notebookId) => {
    const pending: Record<string, UIMessage[]> = { ...get().messagesByNotebook };
    if (!(notebookId in pending)) return;
    delete pending[notebookId];
    set({ messagesByNotebook: pending });
    persist(pending);
  },
}));
