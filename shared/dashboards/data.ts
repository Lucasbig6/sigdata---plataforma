/** Contrato da API de dados ao vivo dos dashboards (frontend ↔ backend). */
import type { ResultColumn } from "../domain/sources";
import type { DataBinding, FilterBinding } from "./types";

/** Filtro ativo enviado pelo editor (dono do painel). */
export type ActiveFilter = FilterBinding & { value: string };

/** Filtro ativo na página pública: referencia o elemento de filtro salvo. */
export type PublicFilter = { elementId: string; value: string };

export type BindingDataRequest = { binding: DataBinding; filters?: ActiveFilter[] };

export type PublicDataRequest = { elementId: string; filters?: PublicFilter[] };

export type BindingData = {
  columns: ResultColumn[];
  rows: Record<string, unknown>[];
  truncated: boolean;
  durationMs: number;
};

export type FilterOptions = { options: string[] };

export const FILTER_VALUE_MAX = 200;
export const FILTER_OPTIONS_LIMIT = 200;
