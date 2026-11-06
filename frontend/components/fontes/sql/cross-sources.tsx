"use client";

import { Check, ChevronDown, Combine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DataSource } from "@/lib/domain/sources";
import { cn } from "@/lib/utils";

/** Quantas fontes um cruzamento aceita (o servidor confere o mesmo limite). */
export const MAX_CROSS_SOURCES = 6;

/** Escolhe as fontes que entram no cruzamento, além da principal. */
export const CrossSourcesPicker = ({
  sources,
  primaryId,
  selected,
  onChange,
}: {
  sources: DataSource[];
  primaryId: string | null;
  selected: string[];
  onChange: (ids: string[]) => void;
}) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const others = sources.filter((entry) => entry.id !== primaryId);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) return event.key === "Escape" ? setOpen(false) : undefined;
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id].slice(0, MAX_CROSS_SOURCES - 1));

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={!primaryId || others.length === 0}
        onClick={() => setOpen((value) => !value)}
        title={others.length === 0 ? "Só há uma fonte disponível" : "Cruzar dados de outras fontes na mesma consulta"}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
          selected.length > 0 && "border-primary/50 text-primary",
        )}
      >
        <Combine className="size-3.5" aria-hidden />
        <span className="hidden md:inline">{selected.length > 0 ? `Cruzando ${selected.length + 1} fontes` : "Cruzar fontes"}</span>
        <ChevronDown className="size-3" aria-hidden />
      </button>
      {open ? (
        <div role="listbox" aria-multiselectable className="absolute left-0 z-30 mt-1 w-72 rounded-lg border border-border bg-popover p-1 shadow-md">
          <p className="px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
            Além da fonte principal, escolha as que entram na consulta. Cite as tabelas como <code className="font-mono">apelido.tabela</code>.
          </p>
          <div className="max-h-64 overflow-auto">
            {others.map((entry) => {
              const on = selected.includes(entry.id);
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => toggle(entry.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-xs outline-none hover:bg-muted focus-visible:bg-muted"
                >
                  <span className={cn("grid size-4 shrink-0 place-items-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                    {on ? <Check className="size-3" aria-hidden /> : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};
