/**
 * Resolução dos dados demonstrativos usados pelos elementos do dashboard.
 *
 * Tudo aqui é DEMONSTRAÇÃO: não existe conexão com banco de dados. As
 * análises salvas na conversa usam exatamente o mesmo formato, de modo que o
 * editor só troca a origem do snapshot.
 */
import {
  KPIS,
  MUNICIPIOS,
  RESUMOS,
  SERIE_TEMPORAL,
  type Municipio,
  type SeriesPoint,
} from "@/lib/demo-data";
import { getAnalysis, type AnalysisSnapshot } from "./analyses";
import type { DatasetRef, FilterKind } from "./types";

export const DEMO_SNAPSHOT: AnalysisSnapshot = {
  kpis: KPIS,
  serie: SERIE_TEMPORAL,
  municipios: MUNICIPIOS,
  resumos: RESUMOS,
};

export const DEMO_DATASET_REF: DatasetRef = {
  source: "demo",
  ref: "demo",
  categoryField: "periodo",
  valueField: "valor",
};

const VALUE_OPTIONS: Record<DatasetRef["categoryField"], string[]> = {
  periodo: ["valor"],
  municipio: ["indice", "receita", "variacao"],
};

export const valueOptionsFor = (
  categoryField: DatasetRef["categoryField"],
): DatasetRef["valueField"][] => VALUE_OPTIONS[categoryField] as DatasetRef["valueField"][];

export const VALUE_LABELS: Record<DatasetRef["valueField"], string> = {
  valor: "Valor do índice",
  indice: "Índice",
  receita: "Receita",
  variacao: "Variação",
  delta: "Variação",
};

export const CATEGORY_LABELS: Record<DatasetRef["categoryField"], string> = {
  periodo: "Período (mês)",
  municipio: "Município",
};

const municipioValue = (row: Municipio, field: DatasetRef["valueField"]): number => {
  if (field === "receita") return row.receita;
  if (field === "variacao" || field === "delta") return row.variacao;
  return row.indice;
};

const snapshotFor = (dataset: DatasetRef): AnalysisSnapshot => {
  if (dataset.source === "analysis") {
    const analysis = getAnalysis(dataset.ref);
    if (analysis) return analysis.snapshot;
  }
  return DEMO_SNAPSHOT;
};

/** Série pronta para gráficos de barras/linhas/área/pizza. */
export const resolveSeries = (dataset: DatasetRef): SeriesPoint[] => {
  const snapshot = snapshotFor(dataset);

  if (dataset.categoryField === "periodo") {
    return snapshot.serie.map((point) => ({ label: point.label, valor: point.valor }));
  }

  const allowed = valueOptionsFor("municipio");
  const field = allowed.includes(dataset.valueField) ? dataset.valueField : allowed[0];

  return snapshot.municipios.map((row) => ({
    label: row.nome,
    valor: municipioValue(row, field),
  }));
};

/** Linhas da tabela (colunas fixas de demonstração). */
export const resolveTableRows = (dataset: DatasetRef): Municipio[] =>
  snapshotFor(dataset).municipios;

/**
 * Tabela com colunas arbitrárias: usa o resultado real salvo na análise quando
 * existir; senão converte as linhas de demonstração.
 */
export const resolveTable = (dataset: DatasetRef): { columns: string[]; rows: Record<string, unknown>[] } => {
  const snapshot = snapshotFor(dataset);
  if (snapshot.tabela && snapshot.tabela.columns.length > 0) return snapshot.tabela;
  return {
    columns: ["Município", "Índice", "Receita (R$ mi)", "Variação (%)"],
    rows: snapshot.municipios.map((row) => ({
      "Município": row.nome,
      "Índice": row.indice,
      "Receita (R$ mi)": row.receita,
      "Variação (%)": row.variacao,
    })),
  };
};

/** Indica se o elemento usa dados reais (análise salva) ou de demonstração. */
export const isDemoDataset = (dataset: DatasetRef) =>
  dataset.source !== "analysis" || !getAnalysis(dataset.ref);

export const resolveKpis = (dataset: DatasetRef) => snapshotFor(dataset).kpis;

export type SourceOption = {
  value: string;
  label: string;
  group: string | null;
};

/** Opções de "fonte de dados": demonstração + análises salvas no chat. */
export const datasetSourceOptions = (analyses: { id: string; title: string }[]): SourceOption[] => [
  { value: "demo", label: "Dados de demonstração", group: null },
  ...analyses.map((analysis) => ({
    value: analysis.id,
    label: analysis.title,
    group: "Análises salvas",
  })),
];

export const FILTER_OPTIONS: Record<FilterKind, string[]> = {
  periodo: ["Últimos 12 meses", "Últimos 6 meses", "Ano corrente", "Ano anterior"],
  categoria: ["Todos os setores", "Saúde", "Educação", "Mobilidade", "Assistência"],
  municipio: ["Todos os municípios", ...MUNICIPIOS.map((row) => row.nome)],
};

export const FILTER_KIND_LABELS: Record<FilterKind, string> = {
  periodo: "Período",
  categoria: "Categoria",
  municipio: "Município",
};
