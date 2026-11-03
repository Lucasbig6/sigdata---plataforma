import { tool } from "ai";
import { z } from "zod";
import type { DataSource, SourceTable } from "@shared/domain/sources";
import { HttpError } from "./http";
import { listSources, runEditorQuery, type Actor } from "./sources/service";

const MAX_SOURCES = 12;
const MAX_TABLES = 25;
const MAX_COLUMNS = 60;
const SAMPLE_ROWS = 20;

/** Mesma regra do editor: só datasets prontos entram nos dashboards (arquivos e bancos brutos, não). */
export const dashboardSources = async (actor: Actor): Promise<DataSource[]> =>
  (await listSources(actor)).filter((source) => source.kind === "dataset" && source.status === "pronta" && source.tables.length > 0);

const describeTable = (table: SourceTable) => {
  const columns = table.columns
    .slice(0, MAX_COLUMNS)
    .map((column) => `${column.name} (${column.kind})`)
    .join(", ");
  const more = table.columns.length > MAX_COLUMNS ? ", …" : "";
  const rows = table.rowCount != null ? ` — ${table.rowCount} linhas` : "";
  return `  - ${table.name}${rows}: ${columns}${more}`;
};

/** Instruções do assistente de dashboards, com as fontes que a pessoa pode usar. */
export const buildDashboardPrompt = (sources: DataSource[]) => {
  const catalog = sources.length
    ? sources
        .slice(0, MAX_SOURCES)
        .flatMap((source) => [
          `Fonte id=${source.id} — "${source.name}"${source.description ? `: ${source.description}` : ""}`,
          ...source.tables.slice(0, MAX_TABLES).map(describeTable),
          ...(source.tables.length > MAX_TABLES ? [`  - … e mais ${source.tables.length - MAX_TABLES} tabelas`] : []),
        ])
        .join("\n")
    : "Nenhuma fonte disponível. Peça para criar um dataset em Fontes de dados antes de montar o dashboard.";

  return [
    "Você monta dashboards no SIGDATA, em português, com respostas curtas. O usuário vê o painel mudar enquanto você trabalha.",
    "Ferramentas: ler_dashboard, adicionar_elemento, editar_elemento, remover_elemento, organizar_layout, adicionar_pagina, trocar_pagina, amostrar_dados.",
    "Regras:",
    "- Use só fontes, tabelas e colunas listadas abaixo, com os nomes exatos. Se faltar algo, diga o que falta.",
    "- Em dúvida sobre valores de uma coluna, use amostrar_dados. Antes de editar ou remover, use ler_dashboard (ids).",
    "- Prefira tabela/dimensao/medida; sql só se não bastar.",
    "- Gráfico: evolução → line/area; ranking → hbar; categorias → bar; composição → pie/donut; duas medidas → scatter.",
    "- Painel bom: 1 título, filtros (período e 1–2 categorias), 3–4 kpi, 2–6 gráficos/tabelas. Até 10 elementos por pedido.",
    "- Faça várias chamadas de adicionar_elemento no mesmo passo e termine com organizar_layout (não informe posição).",
    "- Em erro de ferramenta, leia a mensagem (ela lista o que existe), corrija e tente de novo no máximo 2 vezes.",
    "- No fim, 1–3 frases sobre o que ficou e um próximo passo. Você não salva: o usuário salva (Ctrl+Z desfaz).",
    "",
    "Fontes (tipos: numero, texto, data, booleano):",
    catalog,
  ].join("\n");
};

/** Ferramentas do servidor do assistente de dashboards. Só lê dados, nunca grava nada. */
export const dashboardServerTools = (ctx: { actor: Actor; allowed: Set<string> }) => ({
  amostrar_dados: tool({
    description:
      "Roda um SELECT somente-leitura numa fonte e devolve as colunas e as primeiras linhas, para você conhecer os valores " +
      "(categorias, datas, faixas) antes de montar um elemento. Não guarda o resultado.",
    inputSchema: z.object({
      fonteId: z.string().describe("Id da fonte, como listado nas instruções."),
      sql: z.string().describe("Uma única consulta SELECT (use LIMIT)."),
    }),
    execute: async ({ fonteId, sql }) => {
      if (!ctx.allowed.has(fonteId)) return { erro: "Fonte não disponível para dashboards." };
      try {
        const out = await runEditorQuery(ctx.actor.id, { sourceId: fonteId, sql, page: 1, pageSize: SAMPLE_ROWS, count: false });
        return {
          colunas: out.columns.map((column) => ({ nome: column.name, tipo: column.kind })),
          amostra: out.rows,
          haMais: out.hasMore,
        };
      } catch (error) {
        if (error instanceof HttpError) return { erro: error.message };
        console.error("[sigdata] amostrar_dados", error);
        return { erro: "Falha inesperada ao executar a consulta." };
      }
    },
  }),
});
