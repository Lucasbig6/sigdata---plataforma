import type { AnalyticResult } from "./sources";

/**
 * Célula SQL do notebook do projeto. Fica intercalada com as células de IA
 * (as mensagens do chat): `afterMessageId` é a mensagem depois da qual ela
 * aparece (`null` = antes de qualquer mensagem). Várias células no mesmo ponto
 * seguem `position`.
 */
export type SqlCell = {
  id: string;
  projectId: string;
  afterMessageId: string | null;
  position: number;
  title: string;
  sql: string;
  /** Dataset em que a última execução rodou. */
  sourceId: string | null;
  /** Última execução (as linhas vêm do resultado salvo). */
  result: AnalyticResult | null;
  /** Nº da execução no projeto, como o [n] do Jupyter (null = nunca executada). */
  runNumber: number | null;
  createdAt: string;
  updatedAt: string;
};

export const MAX_CELLS_PER_PROJECT = 100;
