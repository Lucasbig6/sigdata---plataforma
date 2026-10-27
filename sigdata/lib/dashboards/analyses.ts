/**
 * Análises salvas a partir da conversa.
 *
 * Formato comum de visualização (chat -> editor): o snapshot guarda os mesmos
 * tipos usados pelos dados fictícios do projeto, permitindo que uma análise
 * salva vire um elemento do dashboard sem reestruturar o chat.
 *
 * Persistência local (localStorage). Nenhum dado sensível é armazenado.
 */
import type { Kpi, Municipio, ResumoItem, SeriesPoint } from "@/lib/demo-data";

export const ANALYSES_STORAGE_KEY = "sigdata.analyses.v1";
export const ANALYSES_LIMIT = 20;

export type AnalysisSnapshot = {
  kpis: Kpi[];
  serie: SeriesPoint[];
  municipios: Municipio[];
  resumos: ResumoItem[];
};

export type SavedAnalysis = {
  id: string;
  title: string;
  savedAt: number;
  source: "chat";
  snapshot: AnalysisSnapshot;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readRaw = (): unknown => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ANALYSES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
};

const writeRaw = (data: SavedAnalysis[]): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANALYSES_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* modo privado / storage indisponível */
  }
};

const sanitize = (raw: unknown): SavedAnalysis[] => {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is SavedAnalysis => {
    if (!isRecord(item)) return false;
    return (
      typeof item.id === "string" &&
      typeof item.title === "string" &&
      typeof item.savedAt === "number" &&
      isRecord(item.snapshot)
    );
  }) as SavedAnalysis[];
};

export const listAnalyses = (): SavedAnalysis[] => sanitize(readRaw());

export const getAnalysis = (id: string): SavedAnalysis | undefined =>
  listAnalyses().find((analysis) => analysis.id === id);

/**
 * Grava uma análise nova no início da lista (mantém as mais recentes).
 * Se já existir análise com o mesmo título no mesmo dia, substitui em vez de
 * duplicar.
 */
export const saveAnalysis = (snapshot: AnalysisSnapshot, title: string): SavedAnalysis => {
  const analysis: SavedAnalysis = {
    id: `an-${Date.now().toString(36)}`,
    title: title.trim() || "Análise sem título",
    savedAt: Date.now(),
    source: "chat",
    snapshot,
  };
  const existing = listAnalyses().filter((item) => item.title !== analysis.title);
  const next = [analysis, ...existing].slice(0, ANALYSES_LIMIT);
  writeRaw(next);
  return analysis;
};
