"use client";

import { TriangleAlert } from "lucide-react";

const nf = new Intl.NumberFormat("pt-BR");

/** Barra de status: colunas, linhas, avisos e tempo da última execução. */
export const StatusBar = ({
  columns,
  rows,
  hasMoreRows,
  errors,
  step,
  steps,
  durationMs,
  loading,
}: {
  columns: number | null;
  rows: number | null;
  /** O total não pôde ser contado: o número é só das linhas carregadas. */
  hasMoreRows: boolean;
  errors: number;
  step: number;
  steps: number;
  durationMs: number | null;
  loading: boolean;
}) => (
  <div role="status" className="flex h-7 shrink-0 items-center gap-4 border-t border-border bg-muted/40 px-3 text-xs text-muted-foreground">
    {errors > 0 ? (
      <span className="flex items-center gap-1 text-destructive">
        <TriangleAlert className="size-3.5" aria-hidden />
        {errors} {errors === 1 ? "erro" : "erros"}
      </span>
    ) : null}
    <span className="tabular-nums">Colunas: {columns ?? "—"}</span>
    <span className="tabular-nums">
      Linhas: {rows === null ? "—" : nf.format(rows)}
      {hasMoreRows ? "+" : ""}
    </span>
    <span className="tabular-nums">
      Etapa {step} de {steps}
    </span>
    <span className="ms-auto tabular-nums">{loading ? "Atualizando…" : durationMs !== null ? `Executado em ${nf.format(durationMs)} ms` : ""}</span>
  </div>
);
