/**
 * Análises salvas a partir da conversa.
 *
 * Formato comum de visualização (chat -> editor): o snapshot guarda os mesmos
 * tipos usados pelos dados fictícios do projeto, permitindo que uma análise
 * salva vire um elemento do dashboard sem reestruturar o chat. `tabela` guarda
 * resultados com colunas arbitrárias (vindos de consultas reais).
 *
 * Persistência no servidor (/api/analyses); leitura síncrona via cache em memória,
 * porque os renderizadores do editor resolvem dados de forma síncrona.
 */
import { create } from "zustand";
import { api, background } from "@/lib/api/client";
import type { AnalysisSnapshot, SavedAnalysis } from "@shared/analyses";

export { ANALYSES_LIMIT } from "@shared/analyses";
export type { AnalysisSnapshot, SavedAnalysis } from "@shared/analyses";

type AnalysesStore = {
  hydrated: boolean;
  analyses: SavedAnalysis[];
  hydrate: () => void;
  /** Carrega um conjunto já conhecido (ex.: página pública de compartilhamento). */
  replace: (analyses: SavedAnalysis[]) => void;
};

let hydrating = false;

export const useAnalysesStore = create<AnalysesStore>((set, get) => ({
  hydrated: false,
  analyses: [],
  hydrate: () => {
    if (get().hydrated || hydrating) return;
    hydrating = true;
    api<SavedAnalysis[]>("/api/analyses")
      .then((analyses) => set({ hydrated: true, analyses }))
      .catch((error: unknown) => {
        console.error("[sigdata] carregar análises:", error);
        set({ hydrated: true });
      })
      .finally(() => {
        hydrating = false;
      });
  },
  replace: (analyses) => set({ hydrated: true, analyses }),
}));

export const listAnalyses = (): SavedAnalysis[] => useAnalysesStore.getState().analyses;

export const getAnalysis = (id: string): SavedAnalysis | undefined =>
  listAnalyses().find((analysis) => analysis.id === id);

/** Grava uma análise nova (otimista) e devolve o registro com id já definido. */
export const saveAnalysis = (snapshot: AnalysisSnapshot, title: string): SavedAnalysis => {
  const analysis: SavedAnalysis = {
    id: `an-${crypto.randomUUID().slice(0, 12)}`,
    title: title.trim() || "Análise sem título",
    savedAt: Date.now(),
    source: "chat",
    snapshot,
  };
  useAnalysesStore.setState({ analyses: [analysis, ...listAnalyses()] });
  background(
    api("/api/analyses", {
      method: "POST",
      json: { id: analysis.id, title: analysis.title, snapshot },
    }),
    "salvar análise",
  );
  return analysis;
};
