/**
 * Resumo e perguntas sugeridas a partir do schema da fonte (já em cache no backend).
 * Determinístico de propósito: funciona sem a IA, é instantâneo e nunca sugere
 * uma coluna que não existe.
 */
import type { SourceColumn, SourceTable } from "@shared/domain/sources";

const MAX_SUGGESTIONS = 4;

const nf = new Intl.NumberFormat("pt-BR");

/** Identificadores e códigos não são medidas nem fazem sentido somados. */
const looksLikeId = (column: SourceColumn, rowCount: number | null) =>
  /(^|_)(id|cod|codigo|código|cpf|cnpj|cep|ibge)($|_)/i.test(column.name) ||
  (rowCount != null && rowCount > 20 && column.profile?.distintos === rowCount);

const TIME_NAME = /(^|_)(mes|ano|data|dt|periodo|período|trimestre|semana|dia)($|_)/i;
const ORDINAL_NAME = /(^|_)(num|numero|número|seq|ordem|posicao|posição)($|_)/i;

type Profile = {
  table: SourceTable;
  measures: SourceColumn[];
  times: SourceColumn[];
  categories: SourceColumn[];
};

const analyze = (table: SourceTable): Profile => {
  const rows = table.rowCount;
  const times = table.columns.filter((c) => c.kind === "data" || TIME_NAME.test(c.name));
  const isTime = (c: SourceColumn) => times.includes(c);
  const measures = table.columns.filter(
    (c) => c.kind === "numero" && !isTime(c) && !looksLikeId(c, rows) && !ORDINAL_NAME.test(c.name),
  );
  // categoria útil para agrupar: poucos valores distintos (ou desconhecido)
  const categories = table.columns
    .filter((c) => c.kind === "texto" && !isTime(c) && !looksLikeId(c, rows))
    .filter((c) => c.profile?.distintos == null || (c.profile.distintos >= 2 && c.profile.distintos <= 40))
    .sort((a, b) => (a.profile?.distintos ?? 999) - (b.profile?.distintos ?? 999));
  return { table, measures, times, categories };
};

const score = (p: Profile) =>
  Math.min(p.measures.length, 3) * 2 + (p.categories.length > 0 ? 2 : 0) + (p.times.length > 0 ? 1 : 0);

/** Tabela principal: a que mais permite análises (empate: mais linhas). */
export const mainTable = (tables: SourceTable[]): SourceTable | null =>
  tables
    .map(analyze)
    .sort((a, b) => score(b) - score(a) || (b.table.rowCount ?? 0) - (a.table.rowCount ?? 0))[0]?.table ?? null;

export const sourceSummary = (tables: SourceTable[]): string => {
  if (tables.length === 0) return "Nenhuma tabela encontrada nesta fonte.";
  const rows = tables.reduce((sum, table) => sum + (table.rowCount ?? 0), 0);
  const columns = tables.reduce((sum, table) => sum + table.columns.length, 0);
  const parts = [
    `${tables.length} ${tables.length === 1 ? "tabela" : "tabelas"}`,
    rows > 0 ? `${nf.format(rows)} linhas` : null,
    `${columns} colunas`,
  ].filter(Boolean);

  const date = tables.flatMap((t) => t.columns).find((c) => c.kind === "data" && c.profile?.min && c.profile.max);
  const range = date?.profile ? ` · "${date.name}" de ${date.profile.min} a ${date.profile.max}` : "";
  return parts.join(" · ") + range;
};

export const suggestQuestions = (tables: SourceTable[]): string[] => {
  const profiles = tables.map(analyze).sort((a, b) => score(b) - score(a) || (b.table.rowCount ?? 0) - (a.table.rowCount ?? 0));
  const main = profiles[0];
  if (!main) return [];

  const { table, measures, categories } = main;
  const name = (column: SourceColumn) => `"${column.name}"`;
  const questions: string[] = [];

  questions.push(`Faça um resumo geral da tabela ${table.name}: volume de dados e principais indicadores.`);
  if (measures[0] && categories[0]) {
    questions.push(`Qual o total de ${name(measures[0])} por ${name(categories[0])}? Mostre em um gráfico de barras.`);
  }
  // evolução no tempo: da tabela principal ou de qualquer outra que tenha coluna de tempo e medida
  const timed = [main, ...profiles.slice(1)].find((p) => p.times.length > 0 && p.measures.length > 0);
  if (timed) {
    const where = timed === main ? "" : ` na tabela ${timed.table.name}`;
    questions.push(`Como ${name(timed.measures[0])} evoluiu ao longo do tempo (${name(timed.times[0])})${where}?`);
  }
  if (measures[0] && measures[1]) {
    questions.push(`Existe relação entre ${name(measures[0])} e ${name(measures[1])}?`);
  } else if (measures[1] && categories[0] && (categories[0].profile?.distintos ?? 0) >= 5) {
    questions.push(`Quais são os 5 maiores ${name(categories[0])} em ${name(measures[1])}?`);
  }
  if (table.columns.some((c) => (c.profile?.nulosPct ?? 0) > 0)) {
    questions.push("Há valores ausentes nas colunas? Quais precisam de atenção?");
  }
  return questions.slice(0, MAX_SUGGESTIONS);
};
