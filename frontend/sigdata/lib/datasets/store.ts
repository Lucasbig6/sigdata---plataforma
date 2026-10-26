/**
 * Datasets (fontes de dados) definidos pelo analista na home.
 * Persiste apenas metadados em localStorage; o conteúdo em si vive fora do navegador.
 */
import { create } from "zustand";

export type DatasetKind = "demo" | "csv" | "xlsx" | "postgresql";

export type Dataset = {
  id: string;
  name: string;
  description: string;
  kind: DatasetKind;
  createdAt: number;
  updatedAt: number;
};

export const DATASET_KIND_LABELS: Record<DatasetKind, string> = {
  demo: "Demonstração",
  csv: "CSV",
  xlsx: "Excel",
  postgresql: "PostgreSQL",
};

const STORAGE_KEY = "sigdata.datasets.v1";

type Persisted = {
  datasets?: Dataset[];
  selectedId?: string | null;
};

const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ds-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const isValidDataset = (value: unknown): value is Dataset => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.description === "string" &&
    typeof candidate.createdAt === "number" &&
    typeof candidate.updatedAt === "number" &&
    (candidate.kind === undefined ||
      candidate.kind === "demo" ||
      candidate.kind === "csv" ||
      candidate.kind === "xlsx" ||
      candidate.kind === "postgresql")
  );
};

const coerceKind = (value: unknown): DatasetKind =>
  value === "demo" || value === "csv" || value === "xlsx" || value === "postgresql"
    ? value
    : "demo";

const seedDatasets = (): Dataset[] => {
  const now = Date.now();
  return [
    {
      id: uid(),
      name: "Dados de demonstração",
      description: "Indicadores municipais fictícios usados nas análises de demonstração.",
      kind: "demo",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uid(),
      name: "Análises salvas",
      description: "Análises geradas nas conversas e salvas neste navegador.",
      kind: "demo",
      createdAt: now,
      updatedAt: now,
    },
  ];
};

const readPersisted = (): Persisted => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : {};
  } catch {
    return {};
  }
};

const persist = (data: Persisted) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* modo privado / storage indisponível */
  }
};

type DatasetsStore = {
  hydrated: boolean;
  datasets: Dataset[];
  selectedId: string | null;

  hydrate: () => void;
  addDataset: (name: string, description?: string, kind?: DatasetKind) => string;
  removeDataset: (id: string) => void;
  setSelected: (id: string) => void;
};

export const useDatasetsStore = create<DatasetsStore>((set, get) => ({
  hydrated: false,
  datasets: [],
  selectedId: null,

  hydrate: () => {
    if (get().hydrated) return;
    const persisted = readPersisted();
    const stored = Array.isArray(persisted.datasets)
      ? persisted.datasets
          .filter(isValidDataset)
          .map((dataset) => ({ ...dataset, kind: coerceKind(dataset.kind) }))
      : null;
    const datasets = stored ?? seedDatasets();
    const selectedId =
      persisted.selectedId && datasets.some((dataset) => dataset.id === persisted.selectedId)
        ? persisted.selectedId
        : (datasets[0]?.id ?? null);
    set({ hydrated: true, datasets, selectedId });
    if (!stored) persist({ datasets, selectedId });
  },

  addDataset: (name, description = "", kind: DatasetKind = "demo") => {
    const now = Date.now();
    const dataset: Dataset = {
      id: uid(),
      name: name.trim(),
      description: description.trim(),
      kind,
      createdAt: now,
      updatedAt: now,
    };
    const datasets = [dataset, ...get().datasets];
    const selectedId = get().selectedId ?? dataset.id;
    set({ datasets, selectedId });
    persist({ datasets, selectedId });
    return dataset.id;
  },

  removeDataset: (id) => {
    const datasets = get().datasets.filter((dataset) => dataset.id !== id);
    const selectedId =
      get().selectedId === id ? (datasets[0]?.id ?? null) : get().selectedId;
    set({ datasets, selectedId });
    persist({ datasets, selectedId });
  },

  setSelected: (id) => {
    if (!get().datasets.some((dataset) => dataset.id === id)) return;
    const { datasets } = get();
    set({ selectedId: id });
    persist({ datasets, selectedId: id });
  },
}));
