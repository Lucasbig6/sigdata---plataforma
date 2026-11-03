/**
 * Preparação de dados em etapas (estilo "Etapas aplicadas" do Power Query).
 * Cada etapa é um dado estruturado; o servidor compila a lista em SQL.
 * Compartilhado entre cliente e servidor (sem dependências de React ou Node).
 */

import type { ColumnKind } from "./sources";

export type FilterOp = "=" | "!=" | ">" | ">=" | "<" | "<=" | "contem" | "nulo" | "nao_nulo";

/** Operadores que dispensam valor. */
export const FILTER_OPS_WITHOUT_VALUE: readonly FilterOp[] = ["nulo", "nao_nulo"];

export type FilterValue = string | number | boolean;

export type TargetType = Exclude<ColumnKind, "outro">;

type StepBase = { id: string };

export type Step =
  | (StepBase & { type: "filtrar"; column: string; op: FilterOp; value?: FilterValue })
  | (StepBase & { type: "renomear"; from: string; to: string })
  | (StepBase & { type: "remover"; columns: string[] })
  | (StepBase & { type: "tipo"; column: string; to: TargetType })
  | (StepBase & { type: "ordenar"; column: string; dir: "asc" | "desc" })
  | (StepBase & { type: "remover_nulos"; columns: string[] })
  | (StepBase & { type: "duplicadas"; columns: string[] });

export type StepType = Step["type"];

export const STEP_LABELS: Record<StepType, string> = {
  filtrar: "Filtrar linhas",
  renomear: "Renomear coluna",
  remover: "Remover colunas",
  tipo: "Mudar tipo",
  ordenar: "Ordenar",
  remover_nulos: "Remover linhas com nulos",
  duplicadas: "Remover duplicadas",
};

/** Tabela de origem e a lista de etapas aplicadas sobre ela. */
export type Pipeline = {
  sourceId: string;
  table: string;
  steps: Step[];
};
