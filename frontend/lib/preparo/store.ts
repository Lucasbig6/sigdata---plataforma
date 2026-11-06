/**
 * Preparação de dados em etapas: consultas abertas (cada uma com fonte, tabela e etapas),
 * a consulta ativa e a prévia do resultado. O estado é de trabalho (não é dado de domínio):
 * só vira dataset ao salvar, e nada disso escreve nas fontes originais.
 */
import { create } from "zustand";
import { api, ApiError } from "@/lib/api/client";
import type { ColumnProfile, ResultColumn } from "@/lib/domain/sources";
import type { QueryDef, Step, Workspace } from "@/lib/domain/transform";

export type PrepResult = {
  columns: ResultColumn[];
  rows: Record<string, unknown>[];
  total: number | null;
  hasMore: boolean;
  sql: string;
  /** SQL de cada etapa aplicada (para a barra de fórmula). */
  stepSql: string[];
  durationMs: number;
};

export type PrepError = { message: string; stepIndex: number | null };

type RunResponse = PrepResult;
type ProfileResponse = { rowCount: number; columns: { name: string; profile?: ColumnProfile }[] };

type PrepStore = {
  queries: QueryDef[];
  activeId: string | null;
  /** Quantas etapas a prévia aplica (`null` = todas). */
  viewAt: number | null;
  page: number;
  pageSize: number;
  result: PrepResult | null;
  profile: Record<string, ColumnProfile>;
  loading: boolean;
  error: PrepError | null;
  /** Coluna selecionada na grade (os botões da faixa de opções agem sobre ela). */
  selectedColumn: string | null;

  /** Abre um espaço de trabalho já montado (por exemplo, o de um dataset salvo). */
  load: (workspace: Workspace) => void;
  reset: () => void;

  addQuery: (input: { sourceId: string; table: string; name?: string }) => string;
  duplicateQuery: (id: string) => void;
  removeQuery: (id: string) => void;
  renameQuery: (id: string, name: string) => void;
  setActive: (id: string) => void;
  /** Consultas que combinam com esta (mesclar/acrescentar) e, portanto, dependem dela. */
  dependentsOf: (id: string) => QueryDef[];

  addStep: (step: Step) => void;
  replaceStep: (id: string, step: Step) => void;
  removeStep: (id: string) => void;
  moveStep: (id: string, delta: -1 | 1) => void;
  viewStep: (viewAt: number | null) => void;
  selectColumn: (name: string | null) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  refresh: () => void;
  /** Colunas do resultado depois de `upTo` etapas da consulta ativa (`undefined` = todas). */
  columnsAt: (upTo?: number) => Promise<ResultColumn[]>;
  distinctValues: (column: string, upTo?: number) => Promise<{ values: string[]; truncated: boolean }>;
  /** Colunas do resultado final de outra consulta (para combinar). */
  columnsOfQuery: (id: string) => Promise<ResultColumn[]>;
};

let token = 0;

const stepIndexOf = (error: unknown): number | null => {
  const match = error instanceof ApiError ? /^Etapa (\d+) \(/.exec(error.message) : null;
  return match ? Number(match[1]) - 1 : null;
};

const references = (query: QueryDef, id: string) =>
  query.steps.some((step) => (step.type === "acrescentar" || step.type === "mesclar") && step.query === id);

const uniqueName = (queries: QueryDef[], wanted: string) => {
  const taken = new Set(queries.map((query) => query.name.toLowerCase()));
  let name = wanted;
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${wanted} (${n})`;
  return name;
};

export const usePreparoStore = create<PrepStore>((set, get) => {
  const workspace = (): Workspace => ({ queries: get().queries, target: get().activeId ?? "" });

  const run = async (options: { profile: boolean }) => {
    const state = get();
    if (!state.activeId) return;
    const mine = ++token;
    set({ loading: true });
    const upTo = state.viewAt ?? undefined;

    const fetchPage = (at: number | undefined) =>
      api<RunResponse>("/api/prep/run", {
        method: "POST",
        json: {
          workspace: workspace(),
          ...(at !== undefined ? { upTo: at } : {}),
          page: state.page,
          pageSize: state.pageSize,
          // o total só muda quando as etapas mudam; trocar de página reaproveita o anterior
          count: options.profile || state.result?.total == null,
        },
      });

    try {
      const out = await fetchPage(upTo);
      if (mine !== token) return;
      set((current) => ({
        loading: false,
        error: null,
        result: { ...out, total: out.total ?? current.result?.total ?? null },
      }));
    } catch (error) {
      if (mine !== token) return;
      const message = error instanceof Error ? error.message : "Não foi possível executar as etapas.";
      const stepIndex = stepIndexOf(error);
      set({ loading: false, error: { message, stepIndex } });
      // mostra os dados da última etapa que ainda funciona
      if (stepIndex !== null && (upTo === undefined || upTo > stepIndex)) {
        try {
          const good = await fetchPage(stepIndex);
          if (mine === token) set({ result: { ...good, total: good.total ?? null } });
        } catch {
          // a etapa anterior também falhou: fica só a mensagem
        }
      }
      return;
    }

    if (!options.profile) return;
    try {
      const out = await api<ProfileResponse>("/api/prep/profile", {
        method: "POST",
        json: { workspace: workspace(), ...(upTo !== undefined ? { upTo } : {}) },
      });
      if (mine !== token) return;
      set({
        profile: Object.fromEntries(
          out.columns.flatMap((column) => (column.profile ? [[column.name, column.profile] as const] : [])),
        ),
      });
    } catch {
      // o perfil é um extra: sem ele a grade continua útil
    }
  };

  const changed = (patch: Partial<PrepStore>) => {
    set({ ...patch, page: 1 });
    void run({ profile: true });
  };

  const updateActive = (fn: (query: QueryDef) => QueryDef, patch: Partial<PrepStore> = {}) => {
    const { activeId, queries } = get();
    changed({ queries: queries.map((query) => (query.id === activeId ? fn(query) : query)), ...patch });
  };

  const emptyView = { viewAt: null, page: 1, result: null, profile: {}, error: null, selectedColumn: null } as const;

  return {
    queries: [],
    activeId: null,
    viewAt: null,
    page: 1,
    pageSize: 100,
    result: null,
    profile: {},
    loading: false,
    error: null,
    selectedColumn: null,

    load: (ws) => {
      token++;
      set({ queries: ws.queries, activeId: ws.target, ...emptyView });
      void run({ profile: true });
    },
    reset: () => {
      token++;
      set({ queries: [], activeId: null, ...emptyView, loading: false });
    },

    addQuery: ({ sourceId, table, name }) => {
      token++;
      const id = crypto.randomUUID();
      const queries = get().queries;
      set({
        queries: [...queries, { id, name: uniqueName(queries, name?.trim() || table), sourceId, table, steps: [] }],
        activeId: id,
        ...emptyView,
      });
      void run({ profile: true });
      return id;
    },
    duplicateQuery: (id) => {
      const source = get().queries.find((query) => query.id === id);
      if (!source) return;
      token++;
      const copy: QueryDef = {
        ...source,
        id: crypto.randomUUID(),
        name: uniqueName(get().queries, source.name),
        steps: source.steps.map((step) => ({ ...step, id: crypto.randomUUID() })),
      };
      set({ queries: [...get().queries, copy], activeId: copy.id, ...emptyView });
      void run({ profile: true });
    },
    removeQuery: (id) => {
      const rest = get().queries.filter((query) => query.id !== id);
      if (rest.length === 0) return get().reset();
      // quem combinava com a consulta removida perde essas etapas
      const cleaned = rest.map((query) => ({
        ...query,
        steps: query.steps.filter((step) => !((step.type === "acrescentar" || step.type === "mesclar") && step.query === id)),
      }));
      const activeId = get().activeId === id ? cleaned[0]!.id : get().activeId;
      token++;
      set({ queries: cleaned, activeId, ...emptyView });
      void run({ profile: true });
    },
    renameQuery: (id, name) => {
      const clean = name.trim();
      if (!clean) return;
      set({ queries: get().queries.map((query) => (query.id === id ? { ...query, name: clean } : query)) });
    },
    setActive: (id) => {
      if (id === get().activeId) return;
      token++;
      set({ activeId: id, ...emptyView });
      void run({ profile: true });
    },
    dependentsOf: (id) => get().queries.filter((query) => query.id !== id && references(query, id)),

    // acrescentar etapa volta a prévia para "todas as etapas"
    addStep: (step) => updateActive((query) => ({ ...query, steps: [...query.steps, step] }), { viewAt: null }),
    replaceStep: (id, step) =>
      updateActive((query) => ({ ...query, steps: query.steps.map((entry) => (entry.id === id ? step : entry)) })),
    removeStep: (id) => {
      const { viewAt } = get();
      const active = get().queries.find((query) => query.id === get().activeId);
      const remaining = (active?.steps.length ?? 1) - 1;
      updateActive((query) => ({ ...query, steps: query.steps.filter((entry) => entry.id !== id) }), {
        viewAt: viewAt !== null && viewAt > remaining ? null : viewAt,
      });
    },
    moveStep: (id, delta) =>
      updateActive((query) => {
        const steps = [...query.steps];
        const from = steps.findIndex((entry) => entry.id === id);
        const to = from + delta;
        if (from < 0 || to < 0 || to >= steps.length) return query;
        [steps[from], steps[to]] = [steps[to]!, steps[from]!];
        return { ...query, steps };
      }),
    viewStep: (viewAt) => {
      const active = get().queries.find((query) => query.id === get().activeId);
      changed({ viewAt: viewAt === (active?.steps.length ?? 0) ? null : viewAt });
    },
    selectColumn: (name) => set({ selectedColumn: name }),
    setPage: (page) => {
      set({ page });
      void run({ profile: false });
    },
    setPageSize: (pageSize) => {
      set({ pageSize, page: 1 });
      void run({ profile: false });
    },
    refresh: () => void run({ profile: true }),

    columnsAt: async (upTo) => {
      const out = await api<RunResponse>("/api/prep/run", {
        method: "POST",
        json: { workspace: workspace(), ...(upTo !== undefined ? { upTo } : {}), page: 1, pageSize: 25, count: false },
      });
      return out.columns;
    },
    columnsOfQuery: async (id) => {
      const out = await api<RunResponse>("/api/prep/run", {
        method: "POST",
        json: { workspace: { queries: get().queries, target: id }, page: 1, pageSize: 25, count: false },
      });
      return out.columns;
    },
    distinctValues: (column, upTo) =>
      api<{ values: string[]; truncated: boolean }>("/api/prep/values", {
        method: "POST",
        json: { workspace: workspace(), ...(upTo !== undefined ? { upTo } : {}), column },
      }),
  };
});
