"use client";

import { useAuiState, useAssistantToolUI, type ToolCallMessagePartProps } from "@assistant-ui/react";
import { ChevronDown, Loader2, SquarePen } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { AnalyticResult } from "@/lib/domain/sources";
import { useCellsStore } from "@/lib/cells/store";
import { fetchResult } from "@/lib/results/client";
import { cn } from "@/lib/utils";
import { CellOutput } from "./cell-output";

type QueryArgs = { sql: string; titulo: string };
type QueryOutput =
  | { resultId: string; colunas: { nome: string; tipo: string }[]; totalLinhas: number; truncado: boolean }
  | { erro: string };

/**
 * Consulta que o agente rodou (ferramenta consultar_dados), mostrada como um nó
 * SQL do notebook: código, saída e "Abrir como célula" para editar e reexecutar
 * sem reescrever o histórico da conversa.
 */
const QueryNode = ({ args, result, status }: ToolCallMessagePartProps<QueryArgs, QueryOutput>) => {
  const projectId = useSearchParams().get("notebook");
  const messageId = useAuiState((s) => s.message.id);
  const add = useCellsStore((state) => state.add);
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState<AnalyticResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  const running = status?.type === "running";
  const failed = result != null && "erro" in result;
  const ok = result != null && "resultId" in result ? result : null;

  // a amostra que o modelo recebe é curta; ao abrir, busca o resultado inteiro
  useEffect(() => {
    if (!open || !ok || full) return;
    let cancelled = false;
    fetchResult(ok.resultId)
      .then((res) => !cancelled && setFull(res))
      .catch((error: Error) => !cancelled && setLoadError(error.message));
    return () => {
      cancelled = true;
    };
  }, [open, ok, full]);

  const openAsCell = () => {
    if (!projectId || !args?.sql) return;
    setCopying(true);
    add(projectId, { afterMessageId: messageId, sql: args.sql, title: args.titulo ?? "" })
      .catch(() => undefined)
      .finally(() => setCopying(false));
  };

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-border bg-card/70 text-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-muted-foreground">
            {running ? <Loader2 className="inline size-3 animate-spin" aria-label="Executando" /> : "SQL"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-foreground">{args?.titulo || "Consulta do agente"}</span>
            <span className={cn("block truncate text-[11px]", failed ? "text-destructive" : "text-muted-foreground")}>
              {running
                ? "Consultando o dataset…"
                : failed
                  ? result.erro
                  : ok
                    ? `${ok.totalLinhas.toLocaleString("pt-BR")} linha(s)${ok.truncado ? " (limitado)" : ""} · ${ok.colunas.map((c) => c.nome).join(", ")}`
                    : "Aguardando…"}
            </span>
          </span>
          <ChevronDown
            className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
        {args?.sql && !running ? (
          <button
            type="button"
            onClick={openAsCell}
            disabled={copying || !projectId}
            title="Cria uma célula SQL com esta consulta logo abaixo da resposta"
            className="flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            {copying ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <SquarePen className="size-3" aria-hidden />}
            Abrir como célula
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="space-y-2.5 border-t border-border/70 px-3 py-2.5">
          <pre className="max-h-48 overflow-auto rounded-lg bg-muted/50 p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground">
            {args?.sql}
          </pre>
          {full ? (
            <CellOutput result={full} title={args?.titulo ?? ""} />
          ) : loadError ? (
            <p className="text-xs text-destructive">{loadError}</p>
          ) : ok ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden /> Carregando resultado…
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

/** Registra a UI do nó SQL para as consultas do agente. */
export const QueryNodeTool = () => {
  useAssistantToolUI({ toolName: "consultar_dados", render: QueryNode });
  return null;
};
