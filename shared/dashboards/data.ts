/** Contrato da API de dados ao vivo dos dashboards (frontend ↔ backend). */
import type { ResultColumn } from "../domain/sources";
import type { DataBinding, FilterBinding } from "./types";

/**
 * Filtro ativo enviado pelo editor (dono do painel).
 * - `range`: o valor é um intervalo de datas `AAAA-MM-DD..AAAA-MM-DD`;
 * - `byName`: vale para qualquer tabela (de qualquer fonte) com uma coluna de mesmo nome.
 */
export type ActiveFilter = FilterBinding & { value: string; range?: boolean; byName?: boolean };

/** Intervalo de datas de um filtro de período (qualquer ponta pode ser vazia). */
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const parseRange = (value: string): { from: string; to: string } | null => {
  const [from = "", to = "", extra] = value.split("..");
  if (extra !== undefined) return null;
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) return null;
  return from || to ? { from, to } : null;
};

/** Filtro ativo na página pública: referencia o elemento de filtro salvo. */
export type PublicFilter = { elementId: string; value: string };

/** `fresh` ignora o cache do servidor (botão "Atualizar" do dono do painel). */
export type BindingDataRequest = { binding: DataBinding; filters?: ActiveFilter[]; fresh?: boolean };

export type PublicDataRequest = { elementId: string; filters?: PublicFilter[] };

export type BindingData = {
  columns: ResultColumn[];
  rows: Record<string, unknown>[];
  truncated: boolean;
  durationMs: number;
  /** Indicador com comparação: valor do período anterior e como ele foi calculado. */
  compare?: { previous: number | null; unit: string; currentLabel: string; previousLabel: string };
};

export type FilterOptions = {
  options: string[];
  /** Colunas de data: menor e maior data (AAAA-MM-DD), para o controle deslizante. */
  min?: string;
  max?: string;
};

/** Separador dos valores marcados num filtro de seleção múltipla (caractere de controle: não aparece em dados). */
export const FILTER_MULTI_SEP = "\u001f";
export const FILTER_MULTI_MAX = 50;
export const splitMulti = (value: string): string[] => (value ? value.split(FILTER_MULTI_SEP) : []);
export const joinMulti = (values: string[]): string => values.join(FILTER_MULTI_SEP);

export const FILTER_VALUE_MAX = 1000;
export const FILTER_OPTIONS_LIMIT = 200;
