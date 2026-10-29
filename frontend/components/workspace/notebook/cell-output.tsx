"use client";

import { BookmarkPlus, Check, Download, Table2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { WIDGET_ICON } from "@/components/sigdata/widget-icons";
import { WidgetView } from "@/components/sigdata/widget-view";
import { downloadCsv } from "@/components/fontes/sql/results-grid";
import type { AnalyticResult } from "@/lib/domain/sources";
import { WIDGET_KIND_LABELS, usePanelStore, type WidgetKind } from "@/lib/panel/store";
import { checkResultFor, widgetDataFromResult } from "@/lib/results/client";
import { cn } from "@/lib/utils";

/** Formas de ver a saída: a tabela crua ou uma visualização rápida. */
const VIEWS = ["tabela", "barras", "barras_h", "linha", "pizza", "kpi"] as const satisfies readonly WidgetKind[];
type View = (typeof VIEWS)[number];

const MAX_TABLE_ROWS = 200;
const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

const cellText = (value: unknown) =>
  value == null ? null : typeof value === "number" ? nf.format(value) : typeof value === "object" ? JSON.stringify(value) : String(value);

const OutputTable = ({ result }: { result: AnalyticResult }) => {
  const rows = result.rows.slice(0, MAX_TABLE_ROWS);
  return (
    <div className="max-h-80 overflow-auto rounded-lg border border-border/70">
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
          <tr>
            <th className="w-10 px-2 py-1.5 text-right font-normal text-muted-foreground/70">#</th>
            {result.columns.map((column) => (
              <th
                key={column.name}
                className={cn(
                  "whitespace-nowrap px-2.5 py-1.5 text-left font-medium text-muted-foreground",
                  column.kind === "numero" && "text-right",
                )}
              >
                {column.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-border/50 hover:bg-muted/30">
              <td className="px-2 py-1 text-right font-mono text-[10px] text-muted-foreground/60">{index + 1}</td>
              {result.columns.map((column) => {
                const text = cellText(row[column.name]);
                return (
                  <td
                    key={column.name}
                    className={cn(
                      "whitespace-nowrap px-2.5 py-1 text-foreground",
                      column.kind === "numero" && "text-right tabular-nums",
                    )}
                  >
                    {text ?? <span className="text-muted-foreground/50 italic">nulo</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Saída de uma célula (SQL do usuário ou consulta da IA): tabela ou visualização
 * rápida, com baixar CSV e salvar no Estúdio do projeto.
 */
export const CellOutput = ({ result, title }: { result: AnalyticResult; title: string }) => {
  const notebookId = useSearchParams().get("notebook");
  const addWidget = usePanelStore((state) => state.addWidget);
  const [view, setView] = useState<View>("tabela");
  const [savedKinds, setSavedKinds] = useState<View[]>([]);
  const [error, setError] = useState<string | null>(null);

  const chart = useMemo(() => {
    if (view === "tabela") return null;
    const problem = checkResultFor(result, view);
    return problem ? { problem } : { data: widgetDataFromResult(result, view) };
  }, [result, view]);

  const save = async () => {
    if (!notebookId) return;
    setError(null);
    try {
      await usePanelStore.getState().load(notebookId);
      const data = view === "tabela" ? widgetDataFromResult(result, "tabela") : chart && "data" in chart ? chart.data : null;
      if (!data) return;
      const widget = addWidget(notebookId, { kind: view, title: title || result.title, ...data });
      if (!widget) throw new Error("O Estúdio atingiu o limite de visualizações.");
      setSavedKinds((kinds) => [...kinds, view]);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const saved = savedKinds.includes(view);
  const canSave = view === "tabela" || (chart !== null && "data" in chart);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <div role="tablist" aria-label="Forma de exibir o resultado" className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border/70 bg-muted/30 p-0.5">
          {VIEWS.map((kind) => {
            const Icon = kind === "tabela" ? Table2 : WIDGET_ICON[kind];
            return (
              <button
                key={kind}
                type="button"
                role="tab"
                aria-selected={view === kind}
                title={WIDGET_KIND_LABELS[kind]}
                onClick={() => setView(kind)}
                className={cn(
                  "flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                  view === kind ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3" aria-hidden />
                <span className="hidden sm:inline">{WIDGET_KIND_LABELS[kind]}</span>
              </button>
            );
          })}
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {result.rowCount.toLocaleString("pt-BR")} linha(s){result.truncated ? " (limitado)" : ""} · {result.durationMs} ms
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => downloadCsv(title || result.title, result.columns, result.rows)}
            className="flex h-6 items-center gap-1 rounded-md px-2 text-[11px] text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Download className="size-3" aria-hidden />
            CSV
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canSave || saved || !notebookId}
            className="flex h-6 items-center gap-1 rounded-md border border-border px-2 text-[11px] font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            {saved ? <Check className="size-3 text-primary" aria-hidden /> : <BookmarkPlus className="size-3" aria-hidden />}
            {saved ? "No Estúdio" : "Salvar no Estúdio"}
          </button>
        </div>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {result.rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          A consulta não retornou linhas.
        </p>
      ) : view === "tabela" ? (
        <OutputTable result={result} />
      ) : chart && "problem" in chart ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          Não dá para desenhar {WIDGET_KIND_LABELS[view].toLowerCase()}: {chart.problem}
        </p>
      ) : chart ? (
        <div className="rounded-lg border border-border/70 bg-background/40 p-2">
          <WidgetView kind={view} data={chart.data} />
        </div>
      ) : null}
      {view === "tabela" && result.rows.length > MAX_TABLE_ROWS ? (
        <p className="text-[11px] text-muted-foreground">
          Mostrando {MAX_TABLE_ROWS} de {result.rows.length.toLocaleString("pt-BR")} linhas. Baixe o CSV para ver tudo.
        </p>
      ) : null}
    </div>
  );
};
