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

export type AggFn = "soma" | "media" | "minimo" | "maximo" | "contagem" | "distintos";

export const AGG_LABELS: Record<AggFn, string> = {
  soma: "Soma",
  media: "Média",
  minimo: "Mínimo",
  maximo: "Máximo",
  contagem: "Contagem",
  distintos: "Valores distintos",
};

export type Aggregation = {
  /** Coluna agregada; `null` só em "contagem" (conta as linhas). */
  column: string | null;
  fn: AggFn;
  /** Nome da coluna no resultado. */
  as: string;
};

export type JoinKind = "esquerda" | "interna" | "direita" | "completa";

export const JOIN_LABELS: Record<JoinKind, string> = {
  esquerda: "Esquerda (mantém todas as linhas daqui)",
  interna: "Interna (só as linhas que casam)",
  direita: "Direita (mantém todas as linhas da outra tabela)",
  completa: "Completa (mantém todas as linhas das duas)",
};

type StepBase = { id: string };

export type Step =
  | (StepBase & { type: "filtrar"; column: string; op: FilterOp; value?: FilterValue })
  | (StepBase & { type: "renomear"; from: string; to: string })
  | (StepBase & { type: "remover"; columns: string[] })
  | (StepBase & { type: "tipo"; column: string; to: TargetType })
  | (StepBase & { type: "ordenar"; column: string; dir: "asc" | "desc" })
  | (StepBase & { type: "remover_nulos"; columns: string[] })
  | (StepBase & { type: "duplicadas"; columns: string[] })
  | (StepBase & { type: "preencher"; column: string; value: FilterValue })
  | (StepBase & { type: "agrupar"; by: string[]; aggregations: Aggregation[] })
  | (StepBase & { type: "escolher"; columns: string[] })
  | (StepBase & { type: "limitar"; mode: "manter" | "remover"; n: number })
  | (StepBase & { type: "dividir"; column: string; delimiter: string; parts: number; removeOriginal: boolean })
  | (StepBase & { type: "substituir"; column: string; find: string; with: string })
  | (StepBase & {
      type: "condicional";
      name: string;
      column: string;
      op: FilterOp;
      value?: FilterValue;
      then: FilterValue;
      otherwise: FilterValue;
    })
  | (StepBase & { type: "indice"; name: string; start: 0 | 1 })
  | (StepBase & {
      type: "calcular";
      name: string;
      left: string;
      op: "+" | "-" | "*" | "/";
      right: { column: string } | { value: number };
    })
  | (StepBase & { type: "texto"; column: string; fn: "maiusculas" | "minusculas" | "aparar" })
  | (StepBase & { type: "data_parte"; column: string; part: DatePart; name: string })
  | (StepBase & { type: "arredondar"; column: string; digits: number })
  | (StepBase & { type: "filtrar_valores"; column: string; values: string[]; mode: "incluir" | "excluir" })
  | (StepBase & {
      type: "acrescentar";
      /** Consulta cujas linhas entram no fim (colunas casadas pelo nome). */
      query: string;
    })
  | (StepBase & {
      type: "mesclar";
      /** Outra tabela da mesma fonte (vazio quando `query` está definido). */
      table: string;
      /** Outra consulta do espaço de trabalho, de qualquer fonte: tem prioridade sobre `table`. */
      query?: string;
      kind: JoinKind;
      on: { left: string; right: string }[];
      /** Colunas da outra tabela a trazer; vazio = todas, menos as chaves. */
      columns: string[];
    })
  | (StepBase & {
      type: "dinamizar";
      /** Coluna cujos valores viram colunas. */
      column: string;
      /** Valores (da coluna acima) que viram colunas. */
      values: string[];
      /** Coluna agregada em cada nova coluna. */
      value: string;
      fn: AggFn;
      /** Colunas que continuam como linhas. */
      by: string[];
    });

export type DatePart = "ano" | "mes" | "dia" | "trimestre" | "dia_semana";

export const DATE_PART_LABELS: Record<DatePart, string> = {
  ano: "Ano",
  mes: "Mês",
  dia: "Dia",
  trimestre: "Trimestre",
  dia_semana: "Dia da semana (1 = segunda)",
};

export type StepType = Step["type"];

export const STEP_LABELS: Record<StepType, string> = {
  filtrar: "Filtrar linhas",
  renomear: "Renomear coluna",
  remover: "Remover colunas",
  tipo: "Mudar tipo",
  ordenar: "Ordenar",
  remover_nulos: "Remover linhas com nulos",
  duplicadas: "Remover duplicadas",
  preencher: "Preencher nulos",
  agrupar: "Agrupar e resumir",
  mesclar: "Mesclar com outra tabela",
  dinamizar: "Dinamizar coluna",
  escolher: "Escolher colunas",
  limitar: "Manter ou remover linhas",
  dividir: "Dividir coluna",
  substituir: "Substituir valores",
  condicional: "Coluna condicional",
  indice: "Coluna de índice",
  calcular: "Coluna calculada",
  texto: "Formatar texto",
  data_parte: "Extrair parte da data",
  arredondar: "Arredondar",
  filtrar_valores: "Filtrar por valores",
  acrescentar: "Acrescentar consulta",
};

/** Uma consulta do espaço de trabalho: tabela de uma fonte e as etapas aplicadas sobre ela. */
export type QueryDef = {
  id: string;
  name: string;
  sourceId: string;
  table: string;
  steps: Step[];
};

/** Todas as consultas abertas e qual delas é o resultado (as demais só alimentam combinações). */
export type Workspace = {
  queries: QueryDef[];
  target: string;
};
