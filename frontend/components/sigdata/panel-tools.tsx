"use client";

import { Check, Loader2, Pencil, Trash2, TriangleAlert, type LucideIcon } from "lucide-react";
import type { JSONSchema7 } from "ai";
import { useAssistantTool, type AssistantToolProps, type ToolCallMessagePartProps } from "@assistant-ui/react";
import { editWidget, isWidgetKind, type WidgetEdit } from "@/lib/panel/edit";
import { WIDGET_KINDS } from "@shared/panel";
import { usePanelStore, type WidgetKind } from "@/lib/panel/store";

/**
 * Ferramentas do agente sobre as visualizações salvas: as mesmas ações que o
 * usuário tem no painel (listar, editar título/tipo/colunas, remover).
 */

const currentNotebook = () => new URLSearchParams(window.location.search).get("notebook");

type ListItem = {
  id: string;
  titulo: string;
  tipo: WidgetKind;
  resultId: string | null;
  x: string | null;
  y: string | null;
};

type ListResult = { ok: true; visualizacoes: ListItem[] } | { ok: false; error: string };

const listTool = {
  toolName: "listar_visualizacoes",
  type: "frontend",
  description:
    "Lista as visualizações salvas no painel do projeto (id, título, tipo, resultId e colunas x/y). " +
    "Chame antes de editar ou remover para obter o id.",
  parameters: { type: "object", properties: {} } satisfies JSONSchema7,
  execute: async (): Promise<ListResult> => {
    const notebookId = currentNotebook();
    if (!notebookId) return { ok: false, error: "Nenhum projeto aberto." };
    const store = usePanelStore.getState();
    await store.load(notebookId);
    return {
      ok: true,
      visualizacoes: usePanelStore
        .getState()
        .getWidgets(notebookId)
        .map((widget) => ({
          id: widget.id,
          titulo: widget.title,
          tipo: widget.kind,
          resultId: widget.resultId ?? null,
          x: widget.xCol ?? null,
          y: widget.yCol ?? null,
        })),
    };
  },
} satisfies AssistantToolProps<Record<string, never>, ListResult>;

type EditArgs = {
  id: string;
  titulo?: string;
  kind?: WidgetKind;
  resultId?: string;
  x?: string;
  y?: string;
  ys?: string[];
  splitBy?: string;
};
type ActionResult = { ok: true; titulo: string } | { ok: false; error: string };

const ToolChip = ({
  icon: Icon,
  label,
  status,
  result,
}: {
  icon: LucideIcon;
  label: string;
  status?: { type: string };
  result?: ActionResult;
}) => {
  const running = status?.type === "running" || status?.type === "requires-action";
  const failed = result?.ok === false || status?.type === "incomplete";
  return (
    <div className="my-1.5 inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-card/60 px-2.5 py-1.5 text-xs">
      {running ? (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
      ) : failed ? (
        <TriangleAlert className="size-3.5 text-destructive" aria-hidden />
      ) : result ? (
        <Check className="size-3.5 text-primary" aria-hidden />
      ) : (
        <Icon className="size-3.5 text-muted-foreground" aria-hidden />
      )}
      <span className="truncate text-foreground">{label}</span>
      {result?.ok === false ? <span className="truncate text-destructive">{result.error}</span> : null}
    </div>
  );
};

const editTool = {
  toolName: "editar_visualizacao",
  type: "frontend",
  description:
    "Edita uma visualização salva no painel, como o usuário faria: muda título, tipo (linha, barras, kpi, tabela) " +
    "ou as colunas x/y. Para mudar dados use um resultId novo de consultar_dados. Informe só o que muda.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "id devolvido por listar_visualizacoes." },
      titulo: { type: "string", description: "Novo título." },
      kind: { type: "string", enum: WIDGET_KINDS, description: "Novo tipo (qualquer gráfico, kpi ou tabela)." },
      resultId: { type: "string", description: "Novo resultado de consultar_dados (troca os dados)." },
      x: { type: "string", description: "Coluna de categoria." },
      y: { type: "string", description: "Coluna de valor." },
      ys: { type: "array", items: { type: "string" }, description: "Colunas numéricas extras (várias séries)." },
      splitBy: { type: "string", description: "Coluna que divide em séries; \"\" remove a divisão." },
    },
    required: ["id"],
  } satisfies JSONSchema7,
  execute: async (args): Promise<ActionResult> => {
    const notebookId = currentNotebook();
    if (!notebookId) return { ok: false, error: "Nenhum projeto aberto." };
    if (args.kind !== undefined && !isWidgetKind(args.kind)) {
      return { ok: false, error: `kind inválido. Use: ${WIDGET_KINDS.join(", ")}.` };
    }
    const edit: WidgetEdit = {
      titulo: args.titulo,
      kind: args.kind,
      resultId: args.resultId,
      x: args.x,
      y: args.y,
      ys: args.ys,
      splitBy: args.splitBy,
    };
    const outcome = await editWidget(notebookId, args.id, edit);
    return outcome.ok ? { ok: true, titulo: outcome.widget.title } : { ok: false, error: outcome.error };
  },
  render: ({ args, result, status }: ToolCallMessagePartProps<EditArgs, ActionResult>) => (
    <ToolChip
      icon={Pencil}
      status={status}
      result={result}
      label={result?.ok ? `Visualização atualizada: ${result.titulo}` : `Editando visualização${args?.titulo ? `: ${args.titulo}` : ""}`}
    />
  ),
} satisfies AssistantToolProps<EditArgs, ActionResult>;

type RemoveArgs = { id: string };

const removeTool = {
  toolName: "remover_visualizacao",
  type: "frontend",
  description: "Remove uma visualização salva do painel. Só use se o usuário pediu para remover/excluir.",
  parameters: {
    type: "object",
    properties: { id: { type: "string", description: "id devolvido por listar_visualizacoes." } },
    required: ["id"],
  } satisfies JSONSchema7,
  execute: async (args): Promise<ActionResult> => {
    const notebookId = currentNotebook();
    if (!notebookId) return { ok: false, error: "Nenhum projeto aberto." };
    const store = usePanelStore.getState();
    await store.load(notebookId);
    const widget = usePanelStore.getState().getWidgets(notebookId).find((entry) => entry.id === args.id);
    if (!widget) return { ok: false, error: `Visualização "${args.id}" não encontrada.` };
    usePanelStore.getState().removeWidget(notebookId, args.id);
    return { ok: true, titulo: widget.title };
  },
  render: ({ result, status }: ToolCallMessagePartProps<RemoveArgs, ActionResult>) => (
    <ToolChip
      icon={Trash2}
      status={status}
      result={result}
      label={result?.ok ? `Visualização removida: ${result.titulo}` : "Removendo visualização"}
    />
  ),
} satisfies AssistantToolProps<RemoveArgs, ActionResult>;

/** Registra as ferramentas de gestão das visualizações salvas. */
export const PanelTools = () => {
  useAssistantTool(listTool);
  useAssistantTool(editTool);
  useAssistantTool(removeTool);
  return null;
};
