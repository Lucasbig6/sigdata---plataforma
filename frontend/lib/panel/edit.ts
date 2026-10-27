/**
 * Edição de uma visualização salva. É a mesma rotina para o usuário (painel)
 * e para o agente (ferramenta editar_visualizacao): título, tipo e colunas.
 */
import { checkResultFor, fetchResult, widgetDataFromResult } from "@/lib/results/client";
import { WIDGET_KINDS, isChartKind } from "@shared/panel";
import { WIDGET_DEFAULT_SIZE, usePanelStore, type PanelWidget, type WidgetKind } from "./store";

export type WidgetEdit = {
  titulo?: string;
  kind?: WidgetKind;
  /** Troca a consulta de origem (resultId de consultar_dados). */
  resultId?: string;
  x?: string;
  y?: string;
  /** Colunas numéricas extras (várias séries). */
  ys?: string[];
  /** Coluna que divide em séries ("" = remover a divisão). */
  splitBy?: string;
  /** Configuração de borda do gráfico */
  border?: { width?: number; color?: string; style?: "solid" | "dashed" | "dotted" };
};

export type EditOutcome = { ok: true; widget: PanelWidget } | { ok: false; error: string };

export const isWidgetKind = (value: unknown): value is WidgetKind =>
  typeof value === "string" && (WIDGET_KINDS as string[]).includes(value);

export const editWidget = async (notebookId: string, id: string, edit: WidgetEdit): Promise<EditOutcome> => {
  const store = usePanelStore.getState();
  await store.load(notebookId);
  const widget = usePanelStore.getState().getWidgets(notebookId).find((entry) => entry.id === id);
  if (!widget) return { ok: false, error: `Visualização "${id}" não encontrada no painel.` };

  const kind = edit.kind ?? widget.kind;
  if (edit.kind !== undefined && !isWidgetKind(edit.kind)) {
    return { ok: false, error: `kind inválido. Use: ${WIDGET_KINDS.join(", ")}.` };
  }
  const titulo = edit.titulo?.trim();
  const patch: Partial<PanelWidget> = { ...(titulo && { title: titulo }) };

  const kindChanged = kind !== widget.kind;
  const dataChanged =
    edit.resultId !== undefined ||
    edit.x !== undefined ||
    edit.y !== undefined ||
    edit.ys !== undefined ||
    edit.splitBy !== undefined;
  const resultId = edit.resultId ?? widget.resultId;

  if (kindChanged || dataChanged) {
    const onlyChartSwap = kindChanged && !dataChanged && isChartKind(kind) && isChartKind(widget.kind);
    if (onlyChartSwap) {
      patch.kind = kind;
    } else {
      if (!resultId) {
        return {
          ok: false,
          error: "Esta visualização não tem consulta de origem; só o título (ou trocar entre tipos de gráfico) pode mudar.",
        };
      }
      try {
        const result = await fetchResult(resultId);
        const x = edit.x ?? widget.xCol;
        const y = edit.y ?? widget.yCol;
        const ys = edit.ys ?? widget.ysCols;
        const splitBy = edit.splitBy !== undefined ? edit.splitBy || undefined : widget.splitBy;
        const cols = { x, y, ys, splitBy };
        const problem = checkResultFor(result, kind, cols);
        if (problem) return { ok: false, error: problem };
        Object.assign(patch, {
          kind,
          // limpa os dados antigos: o formato depende do tipo
          series: undefined,
          kpis: undefined,
          rows: undefined,
          table: undefined,
          xCol: undefined,
          yCol: undefined,
          ysCols: undefined,
          splitBy: undefined,
          chart: undefined,
          ...widgetDataFromResult(result, kind, cols),
        });
      } catch (error) {
        return { ok: false, error: (error as Error).message };
      }
    }
    if (kindChanged) {
      patch.w = WIDGET_DEFAULT_SIZE[kind].w;
      patch.h = WIDGET_DEFAULT_SIZE[kind].h;
    }
  }

  // Adiciona configuração de borda se fornecida
  if (edit.border) {
    patch.border = {
      width: edit.border.width,
      color: edit.border.color,
      style: edit.border.style,
    };
  }

  if (Object.keys(patch).length === 0) return { ok: false, error: "Nada para alterar." };
  usePanelStore.getState().updateWidget(notebookId, id, patch);
  const updated = usePanelStore.getState().getWidgets(notebookId).find((entry) => entry.id === id);
  return updated ? { ok: true, widget: updated } : { ok: false, error: "Falha ao atualizar." };
};
