"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Moldura de toda célula do notebook: calha à esquerda (ação + contador, como
 * no Jupyter) e o corpo à direita. As células de IA e de SQL dividem a mesma
 * grade, então o notebook lê como uma coluna só.
 */
export const CellShell = ({
  kind,
  gutter,
  children,
  className,
}: {
  kind: "sql" | "ia" | "saida";
  gutter?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <div data-cell={kind} className={cn("group/cell grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-2", className)}>
    <div className="flex flex-col items-center gap-1 pt-2">{gutter}</div>
    <div
      className={cn(
        "min-w-0",
        kind === "sql" &&
          "overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-colors focus-within:border-primary/50",
        kind === "ia" && "rounded-xl border border-primary/20 bg-primary/[0.04]",
      )}
    >
      {children}
    </div>
  </div>
);

export const CellGutter = ({ action, label }: { action: ReactNode; label?: string }) => (
  <>
    {action}
    {label ? <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">{label}</span> : null}
  </>
);
