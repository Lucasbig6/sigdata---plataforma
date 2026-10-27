import { tool, type UIMessage } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { SourceTable } from "@shared/domain/sources";
import { db, schema } from "./db";
import { HttpError } from "./http";
import { getSourceRow, runQuery } from "./sources/service";

type SourceRow = typeof schema.dataSources.$inferSelect;

const MAX_TABLES_IN_PROMPT = 40;
const MAX_COLUMNS_IN_PROMPT = 60;
const SAMPLE_ROWS_FOR_MODEL = 15;

const describeTables = (tables: SourceTable[]) => {
  const lines = tables.slice(0, MAX_TABLES_IN_PROMPT).map((table) => {
    const cols = table.columns
      .slice(0, MAX_COLUMNS_IN_PROMPT)
      .map((column) => `${column.name}:${column.kind}`)
      .join(", ");
    const more = table.columns.length > MAX_COLUMNS_IN_PROMPT ? ", …" : "";
    const rows = table.rowCount != null ? ` (${table.rowCount} linhas)` : "";
    return `- ${table.name}${rows}: ${cols}${more}`;
  });
  if (tables.length > MAX_TABLES_IN_PROMPT) {
    lines.push(`- … e mais ${tables.length - MAX_TABLES_IN_PROMPT} tabelas não listadas.`);
  }
  return lines.join("\n");
};

/** Instruções do assistente, com o schema da fonte ativa do projeto. */
export const buildSystemPrompt = (source: SourceRow | null) => {
  const base = [
    "Você é o assistente analítico do SIGDATA. Responda em português do Brasil, de forma objetiva.",
    "Regras:",
    "1. Todo número que você apresentar deve vir da ferramenta consultar_dados. Nunca invente valores.",
    "2. Agregue no SQL (GROUP BY, ORDER BY). Para gráficos, limite a no máximo 50 categorias.",
    "3. Para mostrar um gráfico, tabela ou indicador, depois de consultar chame create_visualization",
    "   passando resultId e os nomes das colunas: x = categoria/rótulo, y = valor numérico.",
    "   Para kind=kpi use uma consulta que retorne uma única linha; para kind=tabela x e y são opcionais.",
    "4. Se a consulta falhar, leia o erro, corrija o SQL e tente de novo (no máximo 2 vezes).",
    "5. Depois dos resultados, explique em poucas frases o que os dados mostram.",
  ];
  if (!source) {
    return [
      ...base,
      "",
      "Nenhuma fonte de dados está selecionada neste projeto. Se o usuário pedir números,",
      "peça para escolher uma fonte em 'Conjuntos de dados' na barra lateral (ou criar uma em Fontes de dados).",
    ].join("\n");
  }
  const dialect = source.kind === "postgresql" ? "PostgreSQL" : "DuckDB (sintaxe próxima do PostgreSQL)";
  return [
    ...base,
    "",
    `Fonte ativa: "${source.name}" — dialeto SQL: ${dialect}.`,
    source.description ? `Descrição: ${source.description}` : "",
    "Tabelas e colunas (tipos: numero, texto, data, booleano, outro):",
    describeTables(source.tables),
  ]
    .filter(Boolean)
    .join("\n");
};

export const loadActiveSource = async (userId: string, sourceId: string | null) => {
  if (!sourceId) return null;
  try {
    const row = await getSourceRow(userId, sourceId);
    return row.status === "pronta" ? row : null;
  } catch {
    return null;
  }
};

/** Ferramentas executadas no servidor (os dados nunca passam pelo navegador antes de serem salvos). */
export const serverTools = (ctx: { userId: string; projectId: string; source: SourceRow | null }) => ({
  consultar_dados: tool({
    description:
      "Executa uma consulta SQL somente-leitura (SELECT) na fonte de dados ativa do projeto e salva o resultado. " +
      "Retorna resultId, colunas e uma amostra das linhas.",
    inputSchema: z.object({
      sql: z.string().describe("Uma única consulta SELECT."),
      titulo: z.string().describe("Título curto que descreve o resultado."),
    }),
    execute: async ({ sql, titulo }) => {
      if (!ctx.source) return { erro: "Nenhuma fonte de dados selecionada no projeto." };
      try {
        const result = await runQuery(ctx.userId, {
          sourceId: ctx.source.id,
          projectId: ctx.projectId,
          sql,
          title: titulo,
        });
        return {
          resultId: result.id,
          colunas: result.columns.map((column) => ({ nome: column.name, tipo: column.kind })),
          totalLinhas: result.rowCount,
          truncado: result.truncated,
          amostra: result.rows.slice(0, SAMPLE_ROWS_FOR_MODEL),
        };
      } catch (error) {
        if (error instanceof HttpError) return { erro: error.message };
        console.error("[sigdata] consultar_dados", error);
        return { erro: "Falha inesperada ao executar a consulta." };
      }
    },
  }),
});

/**
 * Arquivos anexados chegam como data URL (podem ter vários MB). No banco guardamos
 * só a referência; o conteúdo já foi usado na resposta.
 */
const stripInlineFiles = (message: UIMessage): UIMessage => ({
  ...message,
  parts: message.parts.map((part) =>
    part.type === "file" && part.url.startsWith("data:") ? { ...part, url: "" } : part,
  ),
});

/** Substitui o histórico do projeto pela versão final da conversa. */
export const persistConversation = async (projectId: string, messages: UIMessage[]) => {
  await db.transaction(async (tx) => {
    await tx.delete(schema.messages).where(eq(schema.messages.projectId, projectId));
    if (messages.length > 0) {
      await tx.insert(schema.messages).values(
        messages.map((message, position) => {
          const clean = stripInlineFiles(message);
          return {
            projectId,
            id: clean.id || `m-${position}`,
            position,
            role: clean.role,
            parts: clean.parts,
            metadata: clean.metadata ?? null,
          };
        }),
      );
    }
    await tx.update(schema.projects).set({ updatedAt: new Date() }).where(eq(schema.projects.id, projectId));
  });
};
