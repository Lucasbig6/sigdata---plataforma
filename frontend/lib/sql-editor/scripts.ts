/**
 * Abas de script do editor SQL. São rascunhos do analista: ficam só no
 * navegador (localStorage, com tolerância a falhas) e não são dados de domínio.
 */
import { create } from "zustand";

export type Script = { id: string; name: string; sql: string; sourceId: string | null };

const KEY = "sigdata:sql-scripts:v1";
const MAX_SCRIPTS = 20;

type ScriptsStore = {
  hydrated: boolean;
  scripts: Script[];
  activeId: string | null;

  hydrate: () => void;
  /** Abre um script novo (ou ativa um idêntico já aberto). */
  open: (input: { sourceId: string | null; sql: string; name?: string }) => string;
  close: (id: string) => void;
  setActive: (id: string) => void;
  setSql: (id: string, sql: string) => void;
  setSource: (id: string, sourceId: string | null) => void;
  rename: (id: string, name: string) => void;
};

const newId = () => `s-${crypto.randomUUID().slice(0, 8)}`;

const read = (): { scripts: Script[]; activeId: string | null } | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { scripts?: Script[]; activeId?: string | null };
    const scripts = (data.scripts ?? []).filter(
      (s) => typeof s?.id === "string" && typeof s.sql === "string" && typeof s.name === "string",
    );
    return scripts.length > 0 ? { scripts, activeId: data.activeId ?? scripts[0].id } : null;
  } catch {
    return null;
  }
};

let timer: ReturnType<typeof setTimeout> | undefined;
const persist = (state: Pick<ScriptsStore, "scripts" | "activeId">) => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ scripts: state.scripts, activeId: state.activeId }));
    } catch {
      // armazenamento indisponível ou cheio: o editor segue funcionando sem persistir
    }
  }, 400);
};

export const useScriptsStore = create<ScriptsStore>((set, get) => {
  const commit = (patch: Partial<Pick<ScriptsStore, "scripts" | "activeId">>) => {
    set(patch);
    persist(get());
  };
  const nextName = () => {
    const used = new Set(get().scripts.map((s) => s.name));
    let n = get().scripts.length + 1;
    while (used.has(`Script ${n}`)) n++;
    return `Script ${n}`;
  };

  return {
    hydrated: false,
    scripts: [],
    activeId: null,

    hydrate: () => {
      if (get().hydrated) return;
      const saved = read();
      set({ hydrated: true, ...saved });
    },

    open: ({ sourceId, sql, name }) => {
      const same = sql.trim()
        ? get().scripts.find((s) => s.sourceId === sourceId && s.sql.trim() === sql.trim())
        : undefined;
      if (same) {
        commit({ activeId: same.id });
        return same.id;
      }
      const script: Script = { id: newId(), name: name ?? nextName(), sql, sourceId };
      commit({ scripts: [...get().scripts, script].slice(-MAX_SCRIPTS), activeId: script.id });
      return script.id;
    },

    close: (id) => {
      const scripts = get().scripts.filter((s) => s.id !== id);
      const index = get().scripts.findIndex((s) => s.id === id);
      const activeId =
        get().activeId === id ? (scripts[Math.min(index, scripts.length - 1)]?.id ?? null) : get().activeId;
      commit({ scripts, activeId });
    },

    setActive: (id) => commit({ activeId: id }),
    setSql: (id, sql) => commit({ scripts: get().scripts.map((s) => (s.id === id ? { ...s, sql } : s)) }),
    setSource: (id, sourceId) =>
      commit({ scripts: get().scripts.map((s) => (s.id === id ? { ...s, sourceId } : s)) }),
    rename: (id, name) =>
      commit({ scripts: get().scripts.map((s) => (s.id === id ? { ...s, name: name.trim() || s.name } : s)) }),
  };
});
