"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Barra de fórmula: mostra o SQL gerado pela etapa selecionada (somente leitura). */
export const FormulaBar = ({ text }: { text: string | null }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex shrink-0 items-start gap-2 border-b border-border bg-background px-3 py-1.5">
      <span className="mt-0.5 font-serif text-sm text-muted-foreground italic select-none" aria-hidden>
        fx
      </span>
      <code
        aria-label="SQL da etapa selecionada"
        className={cn(
          "min-w-0 flex-1 rounded border border-input bg-muted/30 px-2 py-1 font-mono text-xs leading-relaxed text-foreground",
          expanded ? "max-h-48 overflow-auto whitespace-pre-wrap" : "truncate",
        )}
      >
        {text ?? "—"}
      </code>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-label={expanded ? "Recolher a barra de fórmula" : "Expandir a barra de fórmula"}
        aria-expanded={expanded}
        className="mt-0.5 grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted"
      >
        {expanded ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
      </button>
    </div>
  );
};
