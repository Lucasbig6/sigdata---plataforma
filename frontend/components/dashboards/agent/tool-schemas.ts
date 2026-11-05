/**
 * Esquemas das ferramentas do assistente de dashboards (nome, descrição e parâmetros).
 * Ficam num módulo sem React para o servidor e os testes poderem inspecioná-los.
 */
import type { JSONSchema7 } from "ai";
import type { Aggregation, BindingSort } from "@shared/dashboards/types";
import { BINDING_LIMIT_MAX } from "@shared/dashboards/types";
import type { ChartType } from "@shared/charts/types";

export const AGGS: Aggregation[] = ["sum", "avg", "count", "min", "max"];
export const SORTS: BindingSort[] = ["valor_desc", "valor_asc", "label_asc", "label_desc"];
export const CHART_TYPES: ChartType[] = ["bar", "line", "pie", "area", "hbar", "combo", "donut", "scatter", "radar", "funnel", "gauge", "treemap", "heatmap", "map", "mapbubbles"];

/** Parâmetros de dados, curtos de propósito: tudo isto é reenviado ao modelo a cada passo. */
export const BINDING_PROPERTIES = {
  fonteId: { type: "string", description: "Id da fonte (omita se houver só uma)." },
  tabela: { type: "string", description: "Tabela (omita se a fonte tiver só uma)." },
  dimensao: { type: "string", description: "Coluna de categoria (eixo X)." },
  medida: { type: "string", description: "Coluna numérica somada; omita para contar linhas." },
  agregacao: { type: "string", enum: AGGS, description: "Padrão sum." },
  ordenacao: { type: "string", enum: SORTS },
  limite: { type: "number", description: `Máx. categorias/linhas (até ${BINDING_LIMIT_MAX}).` },
  colunas: { type: "array", items: { type: "string" }, description: "Tabela: colunas exibidas (vazio = todas)." },
  dividirPor: { type: "string", description: "Coluna que vira uma série por valor." },
  sql: { type: "string", description: "SELECT, só se o construtor não bastar (use com x e y)." },
  x: { type: "string", description: "Com sql: coluna de categoria." },
  y: { type: "string", description: "Com sql: coluna numérica." },
} satisfies Record<string, JSONSchema7>;

const GEOMETRY = {
  posX: { type: "number" },
  posY: { type: "number" },
  largura: { type: "number" },
  altura: { type: "number" },
} satisfies Record<string, JSONSchema7>;

export const SCHEMAS: Record<string, { description: string; parameters: JSONSchema7 }> = {
  ler_dashboard: {
    description: "Lê o dashboard aberto: páginas, tela e elementos (id, tipo, título, posição, dados). Chame antes de editar ou remover.",
    parameters: { type: "object", properties: {} },
  },
  adicionar_elemento: {
    description:
      "Adiciona um elemento. grafico: tipoGrafico + dimensao (+medida). kpi: medida, sem dimensao. tabela: colunas ou dimensao+medida. " +
      "filtro: coluna (filtroDePeriodo=true se for data). texto/titulo: texto. Não informe posição: use organizar_layout no fim.",
    parameters: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["grafico", "tabela", "kpi", "filtro", "texto", "titulo"] },
        titulo: { type: "string" },
        tipoGrafico: { type: "string", enum: CHART_TYPES, description: "bar, hbar=ranking, line, area, pie, donut, scatter, funnel…" },
        coluna: { type: "string", description: "Filtro: coluna controlada." },
        filtroDePeriodo: { type: "boolean" },
        texto: { type: "string" },
        ...BINDING_PROPERTIES,
      },
      required: ["tipo"],
    },
  },
  editar_elemento: {
    description: "Edita um elemento pelo id: título, tipo de gráfico, dados (só o que muda) e posição/tamanho.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        titulo: { type: "string" },
        tipoGrafico: { type: "string", enum: CHART_TYPES },
        texto: { type: "string" },
        ...BINDING_PROPERTIES,
        ...GEOMETRY,
      },
      required: ["id"],
    },
  },
  remover_elemento: {
    description: "Remove um elemento pelo id. Só se o usuário pediu.",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  organizar_layout: {
    description: "Arruma a página ativa (títulos, filtros, indicadores, grade de gráficos). Chame uma vez no fim da montagem.",
    parameters: { type: "object", properties: {} },
  },
  adicionar_pagina: {
    description: "Cria uma página nova e a ativa. Limpa o histórico de desfazer.",
    parameters: { type: "object", properties: { nome: { type: "string" } } },
  },
  trocar_pagina: {
    description: "Muda a página ativa pelo id (de ler_dashboard).",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
};
