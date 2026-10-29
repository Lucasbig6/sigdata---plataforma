"use client";

import { BookmarkPlus, Check, ChevronDown, Database, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { JSONSchema7 } from "ai";
import {
  useAssistantTool,
  useAssistantToolUI,
  type AssistantToolProps,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Kpi, Municipio, SeriesPoint } from "@/lib/demo-data";
import { WIDGET_KIND_LABELS, usePanelStore, type WidgetData, type WidgetKind } from "@/lib/panel/store";
import { WIDGET_CHART_TYPE, WIDGET_KINDS, isChartKind } from "@shared/panel";
import { WIDGET_ICON } from "./widget-icons";
import { WidgetView } from "./widget-view";
import { checkResultFor, fetchResult, widgetDataFromResult } from "@/lib/results/client";

export type CreateVisualizationArgs = {
  kind: WidgetKind;
  titulo: string;
  resultId?: string;
  x?: string;
  y?: string;
  ys?: string[];
  splitBy?: string;
  /** true = já fixa a visualização no painel (o usuário pediu para salvar). */
  salvar?: boolean;
  serie?: SeriesPoint[];
  kpis?: { label: string; value: string; delta?: number; hint?: string }[];
  rows?: Municipio[];
};

export type CreateVisualizationResult =
  | { ok: true; kind: WidgetKind; titulo: string; salva?: boolean; widgetId?: string }
  | { ok: false; error: string };

export const createVisualizationParameters: JSONSchema7 = {
  type: "object",
  properties: {
    kind: {
      type: "string",
      enum: WIDGET_KINDS,
      description:
        "Tipo: linha, barras, barras_h (horizontais), area, combo (barras+linhas), pizza, rosca, dispersao, radar, funil, medidor (um valor), treemap, calor (mapa de calor: x × séries), kpi (indicador) ou tabela.",
    },
    titulo: {
      type: "string",
      description: "Título curto da visualização.",
    },
    resultId: {
      type: "string",
      description: "resultId devolvido por consultar_dados. Obrigatório quando há fonte de dados.",
    },
    x: {
      type: "string",
      description: "Coluna do resultado usada como categoria/rótulo (gráficos).",
    },
    y: {
      type: "string",
      description: "Coluna numérica do resultado usada como valor (gráficos e kpi).",
    },
    ys: {
      type: "array",
      items: { type: "string" },
      description: "Colunas numéricas extras para plotar várias séries no mesmo gráfico (além de y).",
    },
    splitBy: {
      type: "string",
      description: "Coluna cujos valores viram uma série cada (alternativa a ys; ex.: ano, região).",
    },
    salvar: {
      type: "boolean",
      description:
        "true só quando o usuário pediu explicitamente para salvar/fixar no painel. Por padrão a visualização aparece no chat com o botão Salvar visualização.",
    },
  },
  required: ["kind", "titulo"],
};

const isWidgetKind = (value: unknown): value is WidgetKind =>
  typeof value === "string" && (WIDGET_KINDS as string[]).includes(value);

const isValidSeries = (value: unknown): value is SeriesPoint[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as SeriesPoint).label === "string" &&
      typeof (item as SeriesPoint).valor === "number",
  );

const isValidKpis = (value: unknown): value is NonNullable<CreateVisualizationArgs["kpis"]> =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { label?: unknown }).label === "string" &&
      typeof (item as { value?: unknown }).value === "string",
  );

const isValidRows = (value: unknown): value is Municipio[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Municipio).nome === "string" &&
      typeof (item as Municipio).indice === "number",
  );

/** Dados do widget: preferencialmente do resultado salvo; dados inline só como compatibilidade. */
const resolveWidgetData = async (args: CreateVisualizationArgs): Promise<WidgetData> => {
  const kind = args.kind;
  if (args.resultId) {
    const result = await fetchResult(args.resultId);
    const cols = { x: args.x, y: args.y, ys: args.ys, splitBy: args.splitBy };
    const problem = checkResultFor(result, kind, cols);
    if (problem) throw new Error(problem);
    return widgetDataFromResult(result, kind, cols);
  }
  if (isChartKind(kind) && isValidSeries(args.serie)) return { series: args.serie };
  if (kind === "kpi" && isValidKpis(args.kpis)) {
    return {
      kpis: args.kpis.map((kpi) => ({ ...kpi, delta: kpi.delta ?? 0, hint: kpi.hint ?? "" })) as Kpi[],
    };
  }
  if (kind === "tabela" && isValidRows(args.rows)) return { rows: args.rows };
  throw new Error("informe resultId (de consultar_dados) para criar a visualização.");
};

const executeCreateVisualization = async (
  args: CreateVisualizationArgs,
): Promise<CreateVisualizationResult> => {
  const titulo = (args?.titulo ?? "").trim();
  if (!isWidgetKind(args?.kind)) {
    return { ok: false, error: `kind inválido. Use: ${WIDGET_KINDS.join(", ")}.` };
  }
  if (!titulo) return { ok: false, error: "titulo é obrigatório." };
  let data: WidgetData;
  try {
    data = await resolveWidgetData(args);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  if (!args.salvar) return { ok: true, kind: args.kind, titulo };

  const notebookId = new URLSearchParams(window.location.search).get("notebook");
  if (!notebookId) return { ok: false, error: "Nenhum projeto aberto para salvar a visualização." };
  const panel = usePanelStore.getState();
  await panel.load(notebookId);
  const widget = panel.addWidget(notebookId, { kind: args.kind, title: titulo, ...data });
  if (!widget) return { ok: false, error: "O painel atingiu o limite de visualizações salvas." };
  return { ok: true, kind: args.kind, titulo, salva: true, widgetId: widget.id };
};

const kindSummary = (args: CreateVisualizationArgs): string => {
  if (args.resultId) {
    const axes = [args.x, args.y].filter(Boolean).join(" × ");
    return axes ? `Resultado da consulta · ${axes}` : "Resultado da consulta";
  }
  if (WIDGET_CHART_TYPE[args.kind]) return `${args.serie?.length ?? 0} pontos de série`;
  if (args.kind === "kpi") return `${args.kpis?.length ?? 0} indicador(es)`;
  return `${args.rows?.length ?? 0} linha(s)`;
};

const CreateVisualizationUI = (
  props: ToolCallMessagePartProps<CreateVisualizationArgs, CreateVisualizationResult>,
) => {
  const { args, result, status, addResult } = props;
  const notebookId = useSearchParams().get("notebook");
  const addWidget = usePanelStore((state) => state.addWidget);
  const widgetsByNotebook = usePanelStore((state) => state.widgetsByNotebook);
  const saved = notebookId ? (widgetsByNotebook[notebookId] ?? []) : [];
  const [clicked, setClicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WidgetData | null>(null);
  const [showQuery, setShowQuery] = useState(false);
  const [queryInfo, setQueryInfo] = useState<{ sql: string; rows: number; ms: number } | null>(null);

  const kind: WidgetKind = isWidgetKind(args?.kind) ? args.kind : "linha";
  const Icon = WIDGET_ICON[kind];
  const titulo = (args?.titulo ?? "").trim() || WIDGET_KIND_LABELS[kind];
  const running = status?.type === "running" || status?.type === "requires-action";
  const failed = status?.type === "incomplete" || (result != null && result.ok === false);
  const ready = result?.ok === true;

  // desenha a visualização assim que a ferramenta validou os dados
  useEffect(() => {
    if (!ready || !args) return;
    let cancelled = false;
    resolveWidgetData({ ...args, kind })
      .then((next) => !cancelled && setData(next))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [ready, args, kind]);

  // consulta de origem do gráfico (transparência: de onde vieram os números)
  const resultId = args?.resultId;
  useEffect(() => {
    if (!ready || !resultId) return;
    let cancelled = false;
    fetchResult(resultId)
      .then((res) => !cancelled && setQueryInfo({ sql: res.sql, rows: res.rowCount, ms: res.durationMs }))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ready, resultId]);

  const isSaved =
    clicked ||
    (result?.ok === true && result.salva === true) ||
    saved.some(
      (widget) =>
        widget.kind === kind &&
        widget.title === titulo &&
        (args?.resultId ? widget.resultId === args.resultId : true),
    );

  const handleSave = async () => {
    if (!notebookId) {
      setError("Abra um projeto antes de salvar visualizações.");
      return;
    }
    if (!data) return;
    setBusy(true);
    try {
      await usePanelStore.getState().load(notebookId);
      const widget = addWidget(notebookId, { kind, title: titulo, ...data });
      if (!widget) throw new Error("O painel atingiu o limite de visualizações salvas.");
      setClicked(true);
      setError(null);
      if (running) addResult({ ok: true, kind, titulo, salva: true, widgetId: widget.id });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="my-2 w-full max-w-xl rounded-xl border border-border bg-card/80 p-3.5 shadow-sm">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{titulo}</p>
            <span className="shrink-0 rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {WIDGET_KIND_LABELS[kind]}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{args ? kindSummary(args) : "Aguardando dados…"}</p>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {!error && failed && result && !result.ok ? (
            <p className="text-xs text-destructive">{result.error}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {running && !args ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              Processando
            </span>
          ) : isSaved ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-primary">
              <Check className="size-3" aria-hidden />
              Salva
            </span>
          ) : failed ? (
            <span className="text-[11px] text-destructive">Falha</span>
          ) : (
            <Button
              type="button"
              size="xs"
              onClick={handleSave}
              className={cn((busy || !data) && "pointer-events-none opacity-60")}
              disabled={busy || !data}
            >
              {busy ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : (
                <BookmarkPlus className="size-3" aria-hidden />
              )}
              Salvar visualização
            </Button>
          )}
        </div>
      </div>

      {data ? (
        <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-border/70 bg-background/50 p-2">
          <WidgetView kind={kind} data={data} />
        </div>
      ) : ready && !error ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" aria-hidden /> Montando visualização…
        </p>
      ) : null}

      {queryInfo ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowQuery((value) => !value)}
            aria-expanded={showQuery}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown className={cn("size-3 transition-transform", showQuery && "rotate-180")} aria-hidden />
            {showQuery ? "Ocultar consulta" : "Ver consulta"}
            <span className="font-normal">
              · {queryInfo.rows.toLocaleString("pt-BR")} linha(s) · {queryInfo.ms} ms
            </span>
          </button>
          {showQuery ? (
            <pre className="mt-1.5 max-h-40 overflow-auto rounded-lg bg-muted/50 p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground">
              {queryInfo.sql}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const createVisualizationTool = {
  toolName: "create_visualization",
  type: "frontend",
  description:
    "Cria uma visualização (linha, barras, kpi ou tabela) a partir de um resultado de consultar_dados. " +
    "Passe resultId e as colunas x (categoria) e y (valor). " +
    "A visualização aparece desenhada no chat com o botão Salvar visualização; " +
    "o usuário salva no painel lateral (ou use salvar=true se ele pedir para salvar).",
  parameters: createVisualizationParameters,
  execute: executeCreateVisualization,
  render: CreateVisualizationUI,
} satisfies AssistantToolProps<CreateVisualizationArgs, CreateVisualizationResult>;

/* ------------------------------------------------- consultar_dados (servidor) */

type QueryArgs = { sql: string; titulo: string };
type QueryOutput =
  | {
      resultId: string;
      colunas: { nome: string; tipo: string }[];
      totalLinhas: number;
      truncado: boolean;
      amostra: Record<string, unknown>[];
    }
  | { erro: string };

const cellText = (value: unknown) =>
  typeof value === "number"
    ? value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
    : value == null
      ? "—"
      : String(value);

const QueryToolUI = ({ args, result, status }: ToolCallMessagePartProps<QueryArgs, QueryOutput>) => {
  const [open, setOpen] = useState(false);
  const running = status?.type === "running";
  const failed = result != null && "erro" in result;
  const ok = result != null && "resultId" in result ? result : null;

  return (
    <div className="my-2 max-w-xl rounded-xl border border-border bg-card/60 text-sm shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start"
        aria-expanded={open}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
          {running ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Database className="size-3.5" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-foreground">
            {args?.titulo || "Consulta aos dados"}
          </span>
          <span className={cn("block truncate text-[11px]", failed ? "text-destructive" : "text-muted-foreground")}>
            {running
              ? "Consultando a fonte de dados…"
              : failed
                ? result.erro
                : ok
                  ? `${ok.totalLinhas} linha(s)${ok.truncado ? " (truncado)" : ""} · ${ok.colunas.length} coluna(s)`
                  : "Aguardando…"}
          </span>
        </span>
        <ChevronDown
          className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="space-y-2 border-t border-border px-3.5 py-3">
          <pre className="max-h-48 overflow-auto rounded-lg bg-muted/50 p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground">
            {args?.sql}
          </pre>
          {ok && ok.amostra.length > 0 ? (
            <div className="max-h-56 overflow-auto rounded-lg border border-border">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-muted/80">
                  <tr>
                    {ok.colunas.map((column) => (
                      <th key={column.nome} className="whitespace-nowrap px-2 py-1.5 text-left font-medium text-muted-foreground">
                        {column.nome}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ok.amostra.map((row, index) => (
                    <tr key={index} className="border-t border-border/60">
                      {ok.colunas.map((column) => (
                        <td key={column.nome} className="whitespace-nowrap px-2 py-1 text-foreground">
                          {cellText(row[column.nome])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

/** Registra create_visualization (frontend) e a UI de consultar_dados (executada no servidor). */
export const VisualizationTools = () => {
  useAssistantTool(createVisualizationTool);
  useAssistantToolUI({ toolName: "consultar_dados", render: QueryToolUI });
  return null;
};
