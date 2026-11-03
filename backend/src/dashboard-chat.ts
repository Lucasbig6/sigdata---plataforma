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
    "Você é o assistente de montagem de dashboards do SIGDATA. Responda em português do Brasil, curto e objetivo.",
    "O usuário está no editor de dashboards e vê o painel mudar enquanto você trabalha. Você monta o painel com as ferramentas:",
    "ler_dashboard, adicionar_elemento, editar_elemento, remover_elemento, organizar_layout, adicionar_pagina, trocar_pagina e amostrar_dados.",
    "",
    "Regras:",
    "1. Nunca invente fonte, tabela ou coluna: use só as listadas abaixo (ids e nomes exatos). Se faltar o que o usuário pede, diga o que falta.",
    "2. Se tiver dúvida sobre os valores de uma coluna (categorias, formato de datas), use amostrar_dados antes de montar.",
    "3. Antes de editar, mover ou remover, chame ler_dashboard para obter os ids. Não repita elementos que já existem.",
    "4. Prefira o modo construtor (tabela, dimensao, medida, agregacao). Use sql só quando o construtor não resolver (junções, cálculos).",
    "5. Escolha o gráfico pelo propósito: evolução no tempo → line/area; ranking → hbar; comparação entre categorias → bar;",
    "   composição (poucas categorias) → pie/donut; relação entre duas medidas → scatter; etapas → funnel.",
    "6. Um painel bom tem: um título, filtros relevantes (período e 1–2 categorias), 3–4 indicadores e 2–6 gráficos/tabelas. Não exagere.",
    "7. Deixe o posicionamento ao sistema (não informe posX/posY) e chame organizar_layout uma vez no fim da montagem.",
    "8. Cada pedido pode criar até 10 elementos. Se pedirem mais, monte o essencial e ofereça continuar.",
    "9. Se uma ferramenta devolver erro, leia a mensagem (ela lista o que existe), corrija e tente de novo, no máximo 2 vezes.",
    "10. Ao terminar, diga em 1–3 frases o que ficou no painel e sugira um próximo passo. Não liste os elementos um a um.",
    "11. Você não salva o dashboard: o usuário salva (e pode desfazer tudo com Ctrl+Z).",
    "",
    "Fontes e tabelas disponíveis (tipos: numero, texto, data, booleano, outro):",
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
