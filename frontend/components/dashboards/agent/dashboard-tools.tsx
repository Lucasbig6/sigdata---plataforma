"use client";

import { Check, Eye, LayoutGrid, Loader2, Pencil, Plus, Trash2, TriangleAlert, type LucideIcon } from "lucide-react";
import type { JSONSchema7 } from "ai";
import { useAssistantTool, type AssistantToolProps, type ToolCallMessagePartProps } from "@assistant-ui/react";
import { arrangeElements } from "@/lib/dashboards/auto-layout";
import { findLibraryItem } from "@/lib/dashboards/presets";
import { useDashboardsStore } from "@/lib/dashboards/store";
import {
  BINDING_LIMIT_MAX,
  type Aggregation,
  type BindingSort,
  type DashboardElement,
  type DataBinding,
} from "@/lib/dashboards/types";
import { isAnalysisDataset, useDatasetsStore } from "@/lib/datasets/store";
import type { DataSource } from "@/lib/domain/sources";
import type { ChartType } from "@shared/charts/types";
import { cn } from "@/lib/utils";

/**
 * Ferramentas do assistente de dashboards: as mesmas ações do editor (adicionar, editar, mover,
 * remover, páginas), executadas no navegador sobre o rascunho aberto. Nada é salvo no servidor
 * por aqui: quem salva é a pessoa (ou o salvamento automático). Cada pedido do usuário vira um
 * único passo de "desfazer".
 */

/** Chave do passo de desfazer do pedido atual; o painel do assistente a atualiza a cada mensagem. */
let turnKey = "agente:0";
export const setAgentTurn = (userMessages: number) => {
  turnKey = `agente:${userMessages}`;
};

const MAX_ELEMENTS_PER_PAGE = 40;

const AGGS: Aggregation[] = ["sum", "avg", "count", "min", "max"];
const SORTS: BindingSort[] = ["valor_desc", "valor_asc", "label_asc", "label_desc"];
const CHART_TYPES: ChartType[] = ["bar", "line", "pie", "area", "hbar", "combo", "donut", "scatter", "radar", "funnel", "gauge", "treemap", "heatmap"];

type Failure = { ok: false; error: string };

const store = () => useDashboardsStore.getState();

const editable = (): Failure | null => {
  const state = store();
  if (!state.current()) return { ok: false, error: "Nenhum dashboard aberto." };
  if (state.preview) return { ok: false, error: "O dashboard está em pré-visualização. Peça ao usuário para voltar à edição." };
  return null;
};

const sources = (): DataSource[] => useDatasetsStore.getState().datasets.filter(isAnalysisDataset);

/* ------------------------------------------------------------------ ligação */

type BindingArgs = {
  fonteId?: string;
  tabela?: string;
  dimensao?: string;
  medida?: string;
  agregacao?: Aggregation;
  ordenacao?: BindingSort;
  limite?: number;
  colunas?: string[];
  dividirPor?: string;
  sql?: string;
  x?: string;
  y?: string;
  ys?: string[];
};

const BINDING_PROPERTIES = {
  fonteId: { type: "string", description: "Id da fonte (lista no contexto do sistema)." },
  tabela: { type: "string", description: "Tabela da fonte (modo construtor)." },
  dimensao: { type: "string", description: "Coluna de categoria/agrupamento (eixo X do gráfico)." },
  medida: { type: "string", description: "Coluna numérica agregada. Omita para contar linhas." },
  agregacao: { type: "string", enum: AGGS, description: "sum, avg, count, min ou max (padrão sum; count se não houver medida)." },
  ordenacao: { type: "string", enum: SORTS, description: "valor_desc, valor_asc, label_asc ou label_desc." },
  limite: { type: "number", description: `Máximo de categorias/linhas (até ${BINDING_LIMIT_MAX}).` },
  colunas: { type: "array", items: { type: "string" }, description: "Tabela sem agrupamento: colunas exibidas (vazio = todas)." },
  dividirPor: { type: "string", description: "Coluna que vira uma série por valor (gráficos de várias séries)." },
  sql: { type: "string", description: "Modo SQL (consulta SELECT na fonte) quando o construtor não basta. Use com x e y." },
  x: { type: "string", description: "Modo SQL: coluna de categoria do resultado." },
  y: { type: "string", description: "Modo SQL: coluna numérica do resultado." },
  ys: { type: "array", items: { type: "string" }, description: "Modo SQL: colunas numéricas extras." },
} satisfies Record<string, JSONSchema7>;

const columnsOf = (source: DataSource, table: string) => source.tables.find((entry) => entry.name === table)?.columns ?? [];

const listColumns = (source: DataSource, table: string) =>
  columnsOf(source, table)
    .map((column) => `${column.name} (${column.kind})`)
    .join(", ");

/** Monta e confere a ligação; o erro diz o que existe, para o modelo corrigir sozinho. */
const buildBinding = (
  args: BindingArgs,
  kind: "grafico" | "tabela" | "kpi",
  previous?: DataBinding,
): { binding: DataBinding } | Failure => {
  const all = sources();
  const sourceId = args.fonteId ?? previous?.sourceId;
  const source = all.find((entry) => entry.id === sourceId);
  if (!source) {
    return { ok: false, error: `Fonte "${sourceId ?? ""}" não existe. Fontes: ${all.map((entry) => `${entry.id} (${entry.name})`).join("; ") || "nenhuma"}.` };
  }

  if (args.sql !== undefined || previous?.mode === "sql") {
    const sql = args.sql ?? previous?.sql;
    if (!sql) return { ok: false, error: "Informe o SQL." };
    return {
      binding: {
        sourceId: source.id,
        mode: "sql",
        sql,
        x: args.x ?? previous?.x,
        y: args.y ?? previous?.y,
        ...(args.ys ?? previous?.ys ? { ys: args.ys ?? previous?.ys } : {}),
        ...(args.dividirPor ?? previous?.splitBy ? { splitBy: args.dividirPor ?? previous?.splitBy } : {}),
      },
    };
  }

  const table = args.tabela ?? previous?.table;
  if (!table || !source.tables.some((entry) => entry.name === table)) {
    return { ok: false, error: `Tabela "${table ?? ""}" não existe em "${source.name}". Tabelas: ${source.tables.map((entry) => entry.name).join(", ")}.` };
  }
  const columns = columnsOf(source, table);
  const known = (name: string | undefined, label: string): Failure | null =>
    name && !columns.some((column) => column.name === name)
      ? { ok: false, error: `Coluna de ${label} "${name}" não existe em ${table}. Colunas: ${listColumns(source, table)}.` }
      : null;

  const dimension = args.dimensao ?? previous?.dimension;
  const measure = args.medida ?? previous?.measure;
  const split = args.dividirPor ?? previous?.splitBy;
  const failure = known(dimension, "categoria") ?? known(measure, "medida") ?? known(split, "séries");
  if (failure) return failure;
  for (const name of args.colunas ?? []) {
    const bad = known(name, "tabela");
    if (bad) return bad;
  }
  if (measure && columns.find((column) => column.name === measure)?.kind !== "numero") {
    return { ok: false, error: `A medida "${measure}" não é numérica. Use uma coluna numérica ou omita a medida para contar linhas.` };
  }
  if (kind === "grafico" && !dimension) return { ok: false, error: "Gráfico precisa de dimensao (a coluna de categoria)." };
  if (kind === "kpi" && dimension) return { ok: false, error: "Indicador não usa dimensao: ele mostra um único valor." };

  const agg = args.agregacao ?? previous?.agg ?? (measure ? "sum" : "count");
  const limit = Math.min(Math.max(Math.round(args.limite ?? previous?.limit ?? (kind === "tabela" ? 100 : 12)), 1), BINDING_LIMIT_MAX);
  const dateDimension = columns.find((column) => column.name === dimension)?.kind === "data";
  const binding: DataBinding = {
    sourceId: source.id,
    mode: "builder",
    table,
    ...(dimension && { dimension }),
    ...(measure && { measure }),
    agg: measure ? agg : "count",
    ...(kind !== "kpi" && { sort: args.ordenacao ?? previous?.sort ?? (dateDimension ? "label_asc" : "valor_desc") }),
    ...(kind !== "kpi" && { limit }),
    ...(kind === "tabela" && !dimension && { columns: args.colunas ?? previous?.columns ?? [] }),
    ...(split && { splitBy: split }),
  };
  return { binding };
};

/* ------------------------------------------------------------------ resumo */

const titleOf = (element: DashboardElement): string => {
  const props = element.props as { title?: string; label?: string; content?: string };
  return props.title ?? props.label ?? props.content?.slice(0, 60) ?? "";
};

const describeBinding = (element: DashboardElement) => {
  const binding = (element.props as { binding?: DataBinding }).binding;
  if (!binding) return undefined;
  return binding.mode === "sql"
    ? { fonteId: binding.sourceId, modo: "sql", sql: binding.sql, x: binding.x, y: binding.y }
    : { fonteId: binding.sourceId, tabela: binding.table, dimensao: binding.dimension, medida: binding.measure, agregacao: binding.agg, limite: binding.limit };
};

const summarize = (element: DashboardElement) => ({
  id: element.id,
  tipo: element.type === "chart" ? `grafico:${(element.props as { chartType: string }).chartType}` : element.type,
  titulo: titleOf(element),
  x: element.x,
  y: element.y,
  largura: element.w,
  altura: element.h,
  ligacao: describeBinding(element),
});

/* ------------------------------------------------------------------ interface */

type Result = { ok: true; resumo: string; [key: string]: unknown } | Failure;

const Chip = ({
  icon: Icon,
  label,
  status,
  result,
}: {
  icon: LucideIcon;
  label: string;
  status?: { type: string };
  result?: Result;
}) => {
  const running = status?.type === "running" || status?.type === "requires-action";
  const failed = result?.ok === false || status?.type === "incomplete";
  return (
    <div className="my-1 flex max-w-full items-start gap-2 rounded-lg border border-border bg-card/60 px-2.5 py-1.5 text-xs">
      <span className="mt-0.5 shrink-0">
        {running ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
        ) : failed ? (
          <TriangleAlert className="size-3.5 text-destructive" aria-hidden />
        ) : result ? (
          <Check className="size-3.5 text-primary" aria-hidden />
        ) : (
          <Icon className="size-3.5 text-muted-foreground" aria-hidden />
        )}
      </span>
      <span className={cn("min-w-0 break-words", failed ? "text-destructive" : "text-foreground")}>
        {result?.ok === false ? result.error : label}
      </span>
    </div>
  );
};

const renderer =
  <A,>(icon: LucideIcon, working: (args: A) => string) =>
  ({ args, result, status }: ToolCallMessagePartProps<A, Result>) => (
    <Chip icon={icon} status={status} result={result} label={result?.ok ? result.resumo : working(args ?? ({} as A))} />
  );

/* ------------------------------------------------------------------ ferramentas */

const readTool = {
  toolName: "ler_dashboard",
  type: "frontend",
  description:
    "Mostra o dashboard aberto: páginas, tamanho da tela e cada elemento (id, tipo, título, posição, tamanho, ligação de dados). " +
    "Chame antes de editar, mover ou remover, e para não repetir o que já existe.",
  parameters: { type: "object", properties: {} } satisfies JSONSchema7,
  execute: async (): Promise<Result> => {
    const state = store();
    const doc = state.current();
    if (!doc) return { ok: false, error: "Nenhum dashboard aberto." };
    return {
      ok: true,
      resumo: `Lendo o dashboard "${doc.name}"`,
      nome: doc.name,
      paginaAtiva: state.activePageId ?? doc.pages?.[0]?.id ?? null,
      paginas: (doc.pages ?? [{ id: "unica", name: "Página 1" }]).map((page) => ({ id: page.id, nome: page.name })),
      tela: { largura: doc.canvas.width, altura: doc.canvas.height },
      elementos: doc.elements.map(summarize),
    };
  },
  render: renderer<Record<string, never>>(Eye, () => "Lendo o dashboard"),
} satisfies AssistantToolProps<Record<string, never>, Result>;

type AddArgs = BindingArgs & {
  tipo: "grafico" | "tabela" | "kpi" | "filtro" | "texto" | "titulo";
  titulo?: string;
  tipoGrafico?: ChartType;
  unidade?: string;
  coluna?: string;
  filtroDePeriodo?: boolean;
  global?: boolean;
  texto?: string;
  posX?: number;
  posY?: number;
  largura?: number;
  altura?: number;
};

const addTool = {
  toolName: "adicionar_elemento",
  type: "frontend",
  description:
    "Adiciona um elemento ao dashboard aberto (gráfico, tabela, indicador, filtro, texto ou título). " +
    "Omita posX/posY e tamanho: o sistema posiciona; no fim chame organizar_layout. " +
    "Gráfico: tipoGrafico + dimensao (+ medida/agregacao). Indicador (kpi): medida/agregacao, sem dimensao. " +
    "Filtro: coluna (e filtroDePeriodo=true para coluna de data). Prefira o modo construtor; use sql só se for preciso.",
  parameters: {
    type: "object",
    properties: {
      tipo: { type: "string", enum: ["grafico", "tabela", "kpi", "filtro", "texto", "titulo"] },
      titulo: { type: "string", description: "Título do elemento (rótulo do filtro; texto do título/texto)." },
      tipoGrafico: { type: "string", enum: CHART_TYPES, description: "Só para gráficos. bar=barras, hbar=ranking, line=evolução, pie/donut=composição." },
      unidade: { type: "string", description: "Indicador: unidade exibida (ex.: R$, %)." },
      coluna: { type: "string", description: "Filtro: coluna que ele controla." },
      filtroDePeriodo: { type: "boolean", description: "Filtro de intervalo de datas (a coluna deve ser de data)." },
      global: { type: "boolean", description: "Filtro: vale para todas as páginas e tabelas com coluna de mesmo nome." },
      texto: { type: "string", description: "Conteúdo de texto/título." },
      ...BINDING_PROPERTIES,
      posX: { type: "number" },
      posY: { type: "number" },
      largura: { type: "number" },
      altura: { type: "number" },
    },
    required: ["tipo"],
  } satisfies JSONSchema7,
  execute: async (args): Promise<Result> => {
    const blocked = editable();
    if (blocked) return blocked;
    const state = store();
    const doc = state.current()!;
    if (doc.elements.length >= MAX_ELEMENTS_PER_PAGE) {
      return { ok: false, error: `A página já tem ${MAX_ELEMENTS_PER_PAGE} elementos. Crie outra página.` };
    }

    let itemKey: string;
    let props: Record<string, unknown>;

    if (args.tipo === "texto" || args.tipo === "titulo") {
      const content = (args.texto ?? args.titulo ?? "").trim();
      if (!content) return { ok: false, error: "Informe o texto." };
      itemKey = args.tipo === "texto" ? "text" : "title";
      props = { content: content.slice(0, 2000) };
    } else if (args.tipo === "filtro") {
      const source = sources().find((entry) => entry.id === args.fonteId);
      if (!source) return { ok: false, error: `Fonte "${args.fonteId ?? ""}" não existe. Fontes: ${sources().map((entry) => `${entry.id} (${entry.name})`).join("; ") || "nenhuma"}.` };
      const table = args.tabela;
      if (!table || !source.tables.some((entry) => entry.name === table)) {
        return { ok: false, error: `Informe a tabela. Tabelas de "${source.name}": ${source.tables.map((entry) => entry.name).join(", ")}.` };
      }
      const column = columnsOf(source, table).find((entry) => entry.name === args.coluna);
      if (!column) return { ok: false, error: `Coluna "${args.coluna ?? ""}" não existe em ${table}. Colunas: ${listColumns(source, table)}.` };
      const range = args.filtroDePeriodo === true;
      if (range && column.kind !== "data") return { ok: false, error: `"${column.name}" não é uma coluna de data; não dá para fazer filtro de período.` };
      itemKey = range ? "filter-periodo" : "filter-categoria";
      props = {
        label: args.titulo ?? column.name,
        binding: { sourceId: source.id, table, column: column.name },
        options: [],
        value: "",
        ...(args.global ? { global: true } : {}),
      };
    } else {
      const kind = args.tipo;
      const built = buildBinding(args, kind);
      if ("ok" in built) return built;
      const source = sources().find((entry) => entry.id === built.binding.sourceId)!;
      const title = args.titulo ?? (kind === "kpi" ? (built.binding.measure ?? "Registros") : (built.binding.dimension ?? source.name));
      if (kind === "grafico") {
        itemKey = args.tipoGrafico ?? "bar";
        if (!CHART_TYPES.includes(itemKey as ChartType)) {
          return { ok: false, error: `tipoGrafico inválido. Use: ${CHART_TYPES.join(", ")}.` };
        }
        props = {
          title,
          subtitle: source.name,
          binding: built.binding,
          showLegend: Boolean(built.binding.splitBy) || ["pie", "donut", "funnel"].includes(itemKey),
        };
      } else if (kind === "tabela") {
        itemKey = "table";
        props = { title, binding: built.binding };
      } else {
        itemKey = "kpi";
        props = { title, description: source.name, binding: built.binding, ...(args.unidade ? { unit: args.unidade } : {}) };
      }
    }

    const item = findLibraryItem(itemKey);
    if (!item) return { ok: false, error: `Tipo "${itemKey}" indisponível.` };

    return state.runAsOneStep(turnKey, () => {
      const placement =
        args.posX !== undefined && args.posY !== undefined ? { x: Math.round(args.posX), y: Math.round(args.posY) } : undefined;
      const id = state.addElement(item, placement, props);
      if (!id) return { ok: false, error: "Não foi possível adicionar o elemento." } as Failure;
      if (args.largura || args.altura) {
        const added = store().current()?.elements.find((entry) => entry.id === id);
        if (added) {
          store().patchElement(id, { w: Math.round(args.largura ?? added.w), h: Math.round(args.altura ?? added.h) });
        }
      }
      const title = (props.title as string | undefined) ?? (props.label as string | undefined) ?? (props.content as string | undefined) ?? "";
      return { ok: true, id, resumo: `Adicionado: ${args.tipo === "grafico" ? "gráfico" : args.tipo} ${title}`.trim() };
    });
  },
  render: renderer<AddArgs>(Plus, (args) => `Adicionando ${args.tipo ?? "elemento"}${args.titulo ? `: ${args.titulo}` : ""}`),
} satisfies AssistantToolProps<AddArgs, Result>;

type EditArgs = BindingArgs & {
  id: string;
  titulo?: string;
  tipoGrafico?: ChartType;
  texto?: string;
  posX?: number;
  posY?: number;
  largura?: number;
  altura?: number;
};

const editTool = {
  toolName: "editar_elemento",
  type: "frontend",
  description:
    "Edita um elemento do dashboard: título, tipo de gráfico, dados (informe só o que muda; o resto é mantido), posição e tamanho. " +
    "Use o id de ler_dashboard.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string" },
      titulo: { type: "string" },
      tipoGrafico: { type: "string", enum: CHART_TYPES },
      texto: { type: "string", description: "Novo conteúdo (texto/título)." },
      ...BINDING_PROPERTIES,
      posX: { type: "number" },
      posY: { type: "number" },
      largura: { type: "number" },
      altura: { type: "number" },
    },
    required: ["id"],
  } satisfies JSONSchema7,
  execute: async (args): Promise<Result> => {
    const blocked = editable();
    if (blocked) return blocked;
    const state = store();
    const element = state.current()?.elements.find((entry) => entry.id === args.id);
    if (!element) return { ok: false, error: `Elemento "${args.id}" não encontrado nesta página. Use ler_dashboard.` };

    const propsPatch: Record<string, unknown> = {};
    if (args.titulo !== undefined) {
      propsPatch[element.type === "filter" ? "label" : "title"] = args.titulo;
    }
    if (args.texto !== undefined && (element.type === "text" || element.type === "title")) propsPatch.content = args.texto;
    if (args.tipoGrafico !== undefined) {
      if (element.type !== "chart") return { ok: false, error: "tipoGrafico só vale para gráficos." };
      if (!CHART_TYPES.includes(args.tipoGrafico)) return { ok: false, error: `tipoGrafico inválido. Use: ${CHART_TYPES.join(", ")}.` };
      propsPatch.chartType = args.tipoGrafico;
    }

    const touchesData = ["fonteId", "tabela", "dimensao", "medida", "agregacao", "ordenacao", "limite", "colunas", "dividirPor", "sql", "x", "y", "ys"].some(
      (key) => (args as Record<string, unknown>)[key] !== undefined,
    );
    if (touchesData) {
      if (!["chart", "table", "kpi", "percent", "comparison"].includes(element.type)) {
        return { ok: false, error: "Este elemento não tem dados para alterar." };
      }
      const previous = (element.props as { binding?: DataBinding }).binding;
      const kind = element.type === "chart" ? "grafico" : element.type === "table" ? "tabela" : "kpi";
      const built = buildBinding(args, kind, previous);
      if ("ok" in built) return built;
      propsPatch.binding = built.binding;
    }

    return state.runAsOneStep(turnKey, () => {
      if (Object.keys(propsPatch).length > 0) store().updateProps(element.id, propsPatch, "agente");
      const geometry: Partial<Pick<DashboardElement, "x" | "y" | "w" | "h">> = {};
      if (args.posX !== undefined) geometry.x = Math.round(args.posX);
      if (args.posY !== undefined) geometry.y = Math.round(args.posY);
      if (args.largura !== undefined) geometry.w = Math.round(args.largura);
      if (args.altura !== undefined) geometry.h = Math.round(args.altura);
      if (Object.keys(geometry).length > 0) store().patchElement(element.id, geometry);
      const title = titleOf(store().current()?.elements.find((entry) => entry.id === element.id) ?? element);
      return { ok: true, resumo: `Atualizado: ${title || element.type}` } as Result;
    });
  },
  render: renderer<EditArgs>(Pencil, (args) => `Editando elemento${args.titulo ? `: ${args.titulo}` : ""}`),
} satisfies AssistantToolProps<EditArgs, Result>;

type RemoveArgs = { id: string };

const removeTool = {
  toolName: "remover_elemento",
  type: "frontend",
  description: "Remove um elemento do dashboard. Só use se o usuário pediu para tirar/excluir.",
  parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } satisfies JSONSchema7,
  execute: async (args): Promise<Result> => {
    const blocked = editable();
    if (blocked) return blocked;
    const state = store();
    const element = state.current()?.elements.find((entry) => entry.id === args.id);
    if (!element) return { ok: false, error: `Elemento "${args.id}" não encontrado nesta página.` };
    return state.runAsOneStep(turnKey, () => {
      store().removeElement(element.id);
      return { ok: true, resumo: `Removido: ${titleOf(element) || element.type}` } as Result;
    });
  },
  render: renderer<RemoveArgs>(Trash2, () => "Removendo elemento"),
} satisfies AssistantToolProps<RemoveArgs, Result>;

const arrangeTool = {
  toolName: "organizar_layout",
  type: "frontend",
  description:
    "Arruma a página ativa automaticamente: títulos no topo, filtros numa linha, indicadores lado a lado e gráficos/tabelas " +
    "numa grade de duas colunas. Chame uma vez no fim, depois de adicionar os elementos.",
  parameters: { type: "object", properties: {} } satisfies JSONSchema7,
  execute: async (): Promise<Result> => {
    const blocked = editable();
    if (blocked) return blocked;
    const state = store();
    const doc = state.current()!;
    const { placements, contentHeight } = arrangeElements(doc.elements, doc.canvas);
    if (placements.size === 0) return { ok: true, resumo: "Nada para organizar" };
    return state.runAsOneStep(turnKey, () => {
      if (contentHeight > doc.canvas.height) store().setCanvasSize({ width: doc.canvas.width, height: contentHeight });
      for (const [id, place] of placements) store().patchElement(id, place);
      return { ok: true, resumo: `Layout organizado (${placements.size} elementos)` } as Result;
    });
  },
  render: renderer<Record<string, never>>(LayoutGrid, () => "Organizando o layout"),
} satisfies AssistantToolProps<Record<string, never>, Result>;

type PageArgs = { nome?: string };

const pageTool = {
  toolName: "adicionar_pagina",
  type: "frontend",
  description:
    "Cria uma página nova no dashboard e a deixa ativa; os próximos elementos entram nela. " +
    "Atenção: criar página limpa o histórico de desfazer.",
  parameters: { type: "object", properties: { nome: { type: "string", description: "Nome da página." } } } satisfies JSONSchema7,
  execute: async (args): Promise<Result> => {
    const blocked = editable();
    if (blocked) return blocked;
    store().addPage();
    const state = store();
    if (args.nome?.trim() && state.activePageId) state.renamePage(state.activePageId, args.nome.trim().slice(0, 60));
    const pages = state.current()?.pages;
    return { ok: true, resumo: `Página criada${args.nome ? `: ${args.nome}` : ""}`, totalPaginas: pages?.length ?? 1 };
  },
  render: renderer<PageArgs>(Plus, (args) => `Criando página${args.nome ? `: ${args.nome}` : ""}`),
} satisfies AssistantToolProps<PageArgs, Result>;

type SwitchArgs = { id: string };

const switchTool = {
  toolName: "trocar_pagina",
  type: "frontend",
  description: "Muda a página ativa (os elementos novos entram nela). Use o id de ler_dashboard.",
  parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } satisfies JSONSchema7,
  execute: async (args): Promise<Result> => {
    const doc = store().current();
    if (!doc) return { ok: false, error: "Nenhum dashboard aberto." };
    if (!doc.pages?.some((page) => page.id === args.id)) return { ok: false, error: `Página "${args.id}" não existe.` };
    store().switchPage(args.id);
    return { ok: true, resumo: `Página ativa: ${doc.pages.find((page) => page.id === args.id)?.name ?? args.id}` };
  },
  render: renderer<SwitchArgs>(Eye, () => "Trocando de página"),
} satisfies AssistantToolProps<SwitchArgs, Result>;

/** Registra as ferramentas do assistente de dashboards. */
export const DashboardTools = () => {
  useAssistantTool(readTool);
  useAssistantTool(addTool);
  useAssistantTool(editTool);
  useAssistantTool(removeTool);
  useAssistantTool(arrangeTool);
  useAssistantTool(pageTool);
  useAssistantTool(switchTool);
  return null;
};
