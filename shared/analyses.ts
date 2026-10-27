/** Análises salvas: formato comum entre o chat/painel e o editor de dashboards. */
import type { Kpi, Municipio, ResumoItem, SeriesPoint } from "./demo-data";
import type { GenericTable } from "./panel";

export const ANALYSES_LIMIT = 20;

export type AnalysisSnapshot = {
  kpis: Kpi[];
  serie: SeriesPoint[];
  municipios: Municipio[];
  resumos: ResumoItem[];
  tabela?: GenericTable;
};

export type SavedAnalysis = {
  id: string;
  title: string;
  savedAt: number;
  source: "chat";
  snapshot: AnalysisSnapshot;
};
