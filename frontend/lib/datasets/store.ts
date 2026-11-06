/**
 * Fontes de dados do usuário (/api/sources): arquivos CSV/XLSX carregados no
 * motor analítico e conexões Postgres externas. A fonte ativa é escolhida por
 * projeto (ver `setNotebookSource` em lib/notebooks/store).
 */
import { create } from "zustand";
import { api } from "@/lib/api/client";
import {
  SOURCE_KIND_LABELS,
  type DataSource,
  type ConnectionRequest,
  type SourceKind,
  type SourceTable,
} from "@/lib/domain/sources";
import type { Workspace } from "@/lib/domain/transform";

export type Dataset = DataSource;
export type DatasetKind = SourceKind;
export const DATASET_KIND_LABELS = SOURCE_KIND_LABELS;

/**
 * Fontes oferecidas para análise (chat, dashboards, medidas): só datasets prontos, criados pelos
 * analistas. Arquivos e bancos brutos ficam em Fontes de dados, para quem os gerencia.
 */
export const isAnalysisDataset = (source: Dataset) => source.kind === "dataset" && source.status === "pronta";

export type SourceUsage = { dashboards: number; projects: number; people: number };

type DatasetsStore = {
  hydrated: boolean;
  error: string | null;
  datasets: DataSource[];

  hydrate: () => void;
  reload: () => Promise<void>;
  uploadFile: (input: { file: File; name: string; description: string }) => Promise<DataSource>;
  /** Entra na lista um dataset criado fora das telas de fontes (ex.: dados enviados pelo projeto). */
  addDataset: (source: DataSource) => void;
  testConnection: (request: ConnectionRequest) => Promise<{ tables: number; rows: number | null }>;
  /** Banco externo, API REST ou planilha Google. */
  connectSource: (input: ConnectionRequest & { name: string; description: string }) => Promise<DataSource>;
  /** Com `sourceId` + `sql` (editor SQL) ou `workspace` (preparação de dados em etapas). */
  createDataset: (input: {
    sourceId?: string;
    /** Editor SQL cruzando fontes: a principal primeiro; o SQL cita `apelido.tabela`. */
    sourceIds?: string[];
    sql?: string;
    workspace?: Workspace;
    name: string;
    description: string;
  }) => Promise<DataSource>;
  refreshSchema: (id: string) => Promise<DataSource>;
  profileTable: (id: string, table: string) => Promise<SourceTable>;
  /** `force` confirma mesmo com o dataset em uso por dashboards/projetos. */
  removeDataset: (id: string, force?: boolean) => Promise<void>;
  setPublished: (id: string, published: boolean, force?: boolean) => Promise<void>;
  /** Onde a fonte está em uso (dashboards, projetos e pessoas além do dono). */
  usageOf: (id: string) => Promise<SourceUsage>;
};

let hydrating: Promise<void> | null = null;

export const useDatasetsStore = create<DatasetsStore>((set, get) => {
  const upsert = (source: DataSource) => {
    const exists = get().datasets.some((entry) => entry.id === source.id);
    set({
      datasets: exists
        ? get().datasets.map((entry) => (entry.id === source.id ? source : entry))
        : [source, ...get().datasets],
    });
    return source;
  };

  return {
    hydrated: false,
    error: null,
    datasets: [],

    hydrate: () => {
      if ((get().hydrated && !get().error) || hydrating) return;
      hydrating = get()
        .reload()
        .finally(() => {
          hydrating = null;
        });
    },

    reload: async () => {
      try {
        const datasets = await api<DataSource[]>("/api/sources");
        set({ hydrated: true, datasets, error: null });
      } catch (error) {
        set({ hydrated: true, error: (error as Error).message });
      }
    },

    addDataset: (source) => void upsert(source),

    uploadFile: async ({ file, name, description }) => {
      const form = new FormData();
      form.set("file", file);
      form.set("name", name);
      form.set("description", description);
      return upsert(await api<DataSource>("/api/sources", { method: "POST", body: form }));
    },

    testConnection: (request) =>
      api<{ tables: number; rows: number | null }>("/api/sources/test", { method: "POST", json: request }),

    connectSource: async (input) =>
      upsert(await api<DataSource>("/api/sources", { method: "POST", json: input })),

    createDataset: async (input) =>
      upsert(await api<DataSource>("/api/sources/dataset", { method: "POST", json: input })),

    refreshSchema: async (id) =>
      upsert(await api<DataSource>(`/api/sources/${id}/refresh`, { method: "POST" })),

    profileTable: async (id, table) => {
      const profiled = await api<SourceTable>(
        `/api/sources/${id}/profile?table=${encodeURIComponent(table)}`,
      );
      const source = get().datasets.find((entry) => entry.id === id);
      if (source) {
        upsert({
          ...source,
          tables: source.tables.map((entry) => (entry.name === table ? profiled : entry)),
        });
      }
      return profiled;
    },

    setPublished: async (id, published, force = false) => {
      upsert(await api<DataSource>(`/api/sources/${id}/publish`, { method: "POST", json: { published, force } }));
    },

    usageOf: (id) => api<SourceUsage>(`/api/sources/${id}/usage`),

    removeDataset: async (id, force = false) => {
      await api(`/api/sources/${id}${force ? "?force=true" : ""}`, { method: "DELETE" });
      set({ datasets: get().datasets.filter((entry) => entry.id !== id) });
    },
  };
});
