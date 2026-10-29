/**
 * Catálogo de fontes de dados (/api/sources): arquivos CSV/XLSX carregados no
 * motor analítico, conexões Postgres externas e datasets. Todos leem; criar e
 * alterar é do analista (o backend recusa os demais). A fonte ativa é escolhida
 * por projeto (ver `setNotebookSource` em lib/notebooks/store).
 */
import { create } from "zustand";
import { api } from "@/lib/api/client";
import {
  SOURCE_KIND_LABELS,
  type DataSource,
  type PostgresConnectionInput,
  type SourceKind,
  type SourceTable,
} from "@/lib/domain/sources";

export type Dataset = DataSource;
export type DatasetKind = SourceKind;
export const DATASET_KIND_LABELS = SOURCE_KIND_LABELS;

type DatasetsStore = {
  hydrated: boolean;
  error: string | null;
  datasets: DataSource[];

  hydrate: () => void;
  reload: () => Promise<void>;
  uploadFile: (input: { file: File; name: string; description: string }) => Promise<DataSource>;
  testPostgres: (connection: PostgresConnectionInput) => Promise<{ tables: number }>;
  connectPostgres: (input: {
    name: string;
    description: string;
    connection: PostgresConnectionInput;
  }) => Promise<DataSource>;
  createDataset: (input: {
    sourceId: string;
    sql: string;
    name: string;
    description: string;
  }) => Promise<DataSource>;
  refreshSchema: (id: string) => Promise<DataSource>;
  profileTable: (id: string, table: string) => Promise<SourceTable>;
  removeDataset: (id: string) => Promise<void>;
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

    uploadFile: async ({ file, name, description }) => {
      const form = new FormData();
      form.set("file", file);
      form.set("name", name);
      form.set("description", description);
      return upsert(await api<DataSource>("/api/sources", { method: "POST", body: form }));
    },

    testPostgres: (connection) =>
      api<{ tables: number }>("/api/sources/test", { method: "POST", json: connection }),

    connectPostgres: async (input) =>
      upsert(
        await api<DataSource>("/api/sources", {
          method: "POST",
          json: { kind: "postgresql", ...input },
        }),
      ),

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

    removeDataset: async (id) => {
      await api(`/api/sources/${id}`, { method: "DELETE" });
      set({ datasets: get().datasets.filter((entry) => entry.id !== id) });
    },
  };
});
