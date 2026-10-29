/**
 * Células SQL do notebook de cada projeto (/api/projects/:id/cells). Ficam
 * intercaladas com as células de IA (mensagens do chat) pelo `afterMessageId`.
 * O texto é salvo com atraso enquanto o usuário digita; executar salva antes.
 */
import { create } from "zustand";
import type { SqlCell } from "@shared/domain/cells";
import { api } from "@/lib/api/client";

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

type CellsStore = {
  cellsByProject: Record<string, SqlCell[]>;
  loadState: Record<string, LoadState>;
  running: Record<string, boolean>;
  errors: Record<string, string | undefined>;
  /** Célula recém-criada: recebe o foco do editor uma vez. */
  focusId: string | null;

  load: (projectId: string) => Promise<void>;
  add: (projectId: string, input: { afterMessageId: string | null; sql?: string; title?: string }) => Promise<SqlCell>;
  edit: (projectId: string, cellId: string, patch: { sql?: string; title?: string }) => void;
  run: (projectId: string, cellId: string) => Promise<void>;
  remove: (projectId: string, cellId: string) => Promise<void>;
  clearFocus: () => void;
};

const SAVE_DELAY_MS = 600;
const pendingSaves = new Map<string, { timer: ReturnType<typeof setTimeout>; flush: () => Promise<void> }>();

const cellsPath = (projectId: string, cellId?: string) =>
  `/api/projects/${projectId}/cells${cellId ? `/${cellId}` : ""}`;

export const useCellsStore = create<CellsStore>((set, get) => {
  const replace = (projectId: string, cell: SqlCell) =>
    set({
      cellsByProject: {
        ...get().cellsByProject,
        [projectId]: (get().cellsByProject[projectId] ?? []).map((entry) => (entry.id === cell.id ? cell : entry)),
      },
    });

  const setError = (cellId: string, error: string | undefined) =>
    set({ errors: { ...get().errors, [cellId]: error } });

  const flushSave = async (cellId: string) => {
    const pending = pendingSaves.get(cellId);
    if (!pending) return;
    clearTimeout(pending.timer);
    await pending.flush();
  };

  return {
    cellsByProject: {},
    loadState: {},
    running: {},
    errors: {},
    focusId: null,

    load: async (projectId) => {
      const current = get().loadState[projectId];
      if (current?.status === "loading" || current?.status === "ready") return;
      set({ loadState: { ...get().loadState, [projectId]: { status: "loading" } } });
      try {
        const cells = await api<SqlCell[]>(cellsPath(projectId));
        set({
          cellsByProject: { ...get().cellsByProject, [projectId]: cells },
          loadState: { ...get().loadState, [projectId]: { status: "ready" } },
        });
      } catch (error) {
        set({
          loadState: { ...get().loadState, [projectId]: { status: "error", error: (error as Error).message } },
        });
      }
    },

    add: async (projectId, input) => {
      const cell = await api<SqlCell>(cellsPath(projectId), {
        method: "POST",
        json: { afterMessageId: input.afterMessageId, sql: input.sql ?? "", title: input.title ?? "" },
      });
      set({
        cellsByProject: { ...get().cellsByProject, [projectId]: [...(get().cellsByProject[projectId] ?? []), cell] },
        focusId: cell.id,
      });
      return cell;
    },

    edit: (projectId, cellId, patch) => {
      const cells = get().cellsByProject[projectId] ?? [];
      set({
        cellsByProject: {
          ...get().cellsByProject,
          [projectId]: cells.map((cell) => (cell.id === cellId ? { ...cell, ...patch } : cell)),
        },
      });
      const previous = pendingSaves.get(cellId);
      if (previous) clearTimeout(previous.timer);
      const flush = async () => {
        pendingSaves.delete(cellId);
        const cell = get().cellsByProject[projectId]?.find((entry) => entry.id === cellId);
        if (!cell) return;
        try {
          await api<SqlCell>(cellsPath(projectId, cellId), {
            method: "PATCH",
            json: { sql: cell.sql, title: cell.title },
          });
        } catch (error) {
          setError(cellId, `Não foi possível salvar: ${(error as Error).message}`);
        }
      };
      pendingSaves.set(cellId, { timer: setTimeout(() => void flush(), SAVE_DELAY_MS), flush });
    },

    run: async (projectId, cellId) => {
      if (get().running[cellId]) return;
      set({ running: { ...get().running, [cellId]: true } });
      setError(cellId, undefined);
      try {
        await flushSave(cellId);
        replace(projectId, await api<SqlCell>(`${cellsPath(projectId, cellId)}/run`, { method: "POST" }));
      } catch (error) {
        setError(cellId, (error as Error).message);
      } finally {
        set({ running: { ...get().running, [cellId]: false } });
      }
    },

    remove: async (projectId, cellId) => {
      const pending = pendingSaves.get(cellId);
      if (pending) clearTimeout(pending.timer);
      pendingSaves.delete(cellId);
      await api(cellsPath(projectId, cellId), { method: "DELETE" });
      set({
        cellsByProject: {
          ...get().cellsByProject,
          [projectId]: (get().cellsByProject[projectId] ?? []).filter((cell) => cell.id !== cellId),
        },
      });
    },

    clearFocus: () => set({ focusId: null }),
  };
});
