"use client";

import { Check, LineChart, Loader2, Plus, Table2, BarChart3, Hash } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { JSONSchema7 } from "ai";
import {
  useAssistantTool,
  type AssistantToolProps,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MUNICIPIOS,
  SERIE_TEMPORAL,
  type Kpi,
  type Municipio,
  type SeriesPoint,
} from "@/lib/demo-data";
import { WIDGET_KIND_LABELS, usePanelStore, type WidgetKind } from "@/lib/panel/store";

export type CreateVisualizationArgs = {
  kind: WidgetKind;
  titulo: string;
  serie?: SeriesPoint[];
  kpis?: { label: string; value: string; delta?: number; hint?: string }[];
  rows?: Municipio[];
};

export type CreateVisualizationResult =
  | { ok: true; kind: WidgetKind; titulo: string }
  | { ok: false; error: string };

const SERIES_ITEM: JSONSchema7 = {
  type: "object",
  properties: {
    label: { type: "string" },
    valor: { type: "number" },
  },
  required: ["label", "valor"],
};

const KPI_ITEM: JSONSchema7 = {
  type: "object",
  properties: {
    label: { type: "string" },
    value: { type: "string" },
    delta: { type: "number" },
    hint: { type: "string" },
  },
  required: ["label", "value"],
};

const ROW_ITEM: JSONSchema7 = {
  type: "object",
  properties: {
    nome: { type: "string" },
    indice: { type: "number" },
    variacao: { type: "number" },
    receita: { type: "number" },
  },
  required: ["nome", "indice", "variacao", "receita"],
};

export const createVisualizationParameters: JSONSchema7 = {
  type: "object",
  properties: {
    kind: {
      type: "string",
      enum: ["linha", "barras", "kpi", "tabela"],
      description: "Tipo de visualização a criar no painel lateral.",
    },
    titulo: {
      type: "string",
      description: "Título curto da visualização.",
    },
    serie: {
      type: "array",
      items: SERIES_ITEM,
      description: "Série de pontos {label, valor} para gráficos de linha ou barras.",
    },
    kpis: {
      type: "array",
      items: KPI_ITEM,
      description: "Indicadores para o widget de tipo kpi.",
    },
    rows: {
      type: "array",
      items: ROW_ITEM,
      description: "Linhas da tabela ({nome, indice, variacao, receita}).",
    },
  },
  required: ["kind", "titulo"],
};

const KIND_ICON: Record<WidgetKind, typeof LineChart> = {
  linha: LineChart,
  barras: BarChart3,
  kpi: Hash,
  tabela: Table2,
};

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

const executeCreateVisualization = async (
  args: CreateVisualizationArgs,
): Promise<CreateVisualizationResult> => {
  const kind = args?.kind;
  const titulo = (args?.titulo ?? "").trim();

  if (kind !== "linha" && kind !== "barras" && kind !== "kpi" && kind !== "tabela") {
    return { ok: false, error: "kind inválido. Use linha, barras, kpi ou tabela." };
  }
  if (!titulo) {
    return { ok: false, error: "titulo é obrigatório." };
  }

  if (kind === "linha" || kind === "barras") {
    if (!isValidSeries(args.serie)) {
      return {
        ok: false,
        error: "serie com {label, valor} é obrigatória para gráficos.",
      };
    }
  }

  if (kind === "kpi" && !isValidKpis(args.kpis)) {
    return { ok: false, error: "kpis com {label, value} é obrigatório para indicadores." };
  }

  if (kind === "tabela" && !isValidRows(args.rows)) {
    return {
      ok: false,
      error: "rows com {nome, indice, variacao, receita} é obrigatório para tabelas.",
    };
  }

  return { ok: true, kind, titulo };
};

const kindSummary = (args: CreateVisualizationArgs): string => {
  switch (args.kind) {
    case "linha":
    case "barras":
      return `${args.serie?.length ?? 0} pontos de série`;
    case "kpi":
      return `${args.kpis?.length ?? 0} indicador(es)`;
    case "tabela":
      return `${args.rows?.length ?? 0} linha(s)`;
  }
};

const CreateVisualizationUI = (
  props: ToolCallMessagePartProps<CreateVisualizationArgs, CreateVisualizationResult>,
) => {
  const { args, result, status, addResult } = props;
  const notebookId = useSearchParams().get("notebook");
  const addWidget = usePanelStore((state) => state.addWidget);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kind: WidgetKind =
    args?.kind === "linha" || args?.kind === "barras" || args?.kind === "kpi"
      ? args.kind
      : args?.kind === "tabela"
        ? "tabela"
        : "linha";
  const Icon = KIND_ICON[kind];
  const titulo = (args?.titulo ?? "").trim() || WIDGET_KIND_LABELS[kind];
  const running = status?.type === "running" || status?.type === "requires-action";
  const failed = status?.type === "incomplete" || (result != null && result.ok === false);
  const done = status?.type === "complete" || (result != null && result.ok === true);

  const handleAdd = () => {
    if (!notebookId) {
      setError("Abra um projeto antes de adicionar visualizações ao painel.");
      return;
    }
    const widget = addWidget(notebookId, {
      kind,
      title: titulo,
      ...(args?.serie && isValidSeries(args.serie)
        ? { series: args.serie }
        : kind === "linha" || kind === "barras"
          ? { series: SERIE_TEMPORAL }
          : {}),
      ...(args?.kpis && isValidKpis(args.kpis)
        ? {
            kpis: args.kpis.map((kpi) => ({
              ...kpi,
              delta: kpi.delta ?? 0,
              hint: kpi.hint ?? "",
            })) as Kpi[],
          }
        : {}),
      ...(args?.rows && isValidRows(args.rows)
        ? { rows: args.rows }
        : kind === "tabela"
          ? { rows: MUNICIPIOS }
          : {}),
    });
    if (widget) {
      setAdded(true);
      setError(null);
      if (status?.type === "running" || status?.type === "requires-action") {
        addResult({ ok: true, kind, titulo });
      }
    } else {
      setError("Não foi possível adicionar ao painel.");
    }
  };

  return (
    <div className="my-2 max-w-md rounded-xl border border-border bg-card/80 p-3.5 shadow-sm">
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
          <p className="text-xs text-muted-foreground">
            {args ? kindSummary(args) : "Aguardando dados…"}
          </p>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {running ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              Processando
            </span>
          ) : failed ? (
            <span className="text-[11px] text-destructive">Falha</span>
          ) : added || (done && result?.ok) ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-primary">
              <Check className="size-3" aria-hidden />
              No painel
            </span>
          ) : (
            <Button
              type="button"
              size="xs"
              onClick={handleAdd}
              className={cn(running && "pointer-events-none opacity-60")}
              disabled={running}
            >
              <Plus className="size-3" aria-hidden />
              Adicionar ao painel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const createVisualizationTool = {
  toolName: "create_visualization",
  type: "frontend",
  description:
    "Cria uma visualização (linha, barras, kpi ou tabela) no painel lateral do workspace. " +
    "Use quando o usuário pedir um gráfico, indicador ou tabela. " +
    "Após a chamada, o usuário pode clicar em 'Adicionar ao painel' para fixar o widget.",
  parameters: createVisualizationParameters,
  execute: executeCreateVisualization,
  render: CreateVisualizationUI,
} satisfies AssistantToolProps<CreateVisualizationArgs, CreateVisualizationResult>;

/** Registra a tool create_visualization no model context + render UI. */
export const VisualizationTools = () => {
  useAssistantTool(createVisualizationTool);
  return null;
};
