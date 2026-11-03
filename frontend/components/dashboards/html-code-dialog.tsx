"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { HTML_CODE_MAX } from "@shared/dashboards/types";

type Lang = "html" | "css" | "js";
type Code = Record<Lang, string>;

const TABS: { id: Lang; label: string }[] = [
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "js", label: "JavaScript" },
];

/** Editor do visual personalizado: um campo por linguagem, em janela larga. */
export const HtmlCodeDialog = ({
  open,
  onOpenChange,
  code,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: Code;
  onChange: (lang: Lang, value: string) => void;
}) => {
  const [tab, setTab] = useState<Lang>("html");
  const value = code[tab];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(80dvh,42rem)] w-[min(60rem,calc(100vw-2rem))] max-w-none flex-col gap-3 sm:max-w-none">
        <DialogHeader>
          <DialogTitle>Código do visual</DialogTitle>
          <DialogDescription>
            Roda isolado: sem acesso à sua sessão, à API nem à rede. Os dados da ligação chegam em{" "}
            <code className="font-mono">sigdata.rows</code> e <code className="font-mono">sigdata.columns</code>; use{" "}
            <code className="font-mono">sigdata.onData(fn)</code> para redesenhar quando mudarem. Bibliotecas: cdnjs, jsDelivr e unpkg.
          </DialogDescription>
        </DialogHeader>

        <div role="tablist" className="flex gap-1">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => setTab(entry.id)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                tab === entry.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              {entry.label}
              {code[entry.id].trim() ? <span className="ml-1 text-primary" aria-hidden>•</span> : null}
            </button>
          ))}
          <span className={cn("ml-auto self-center text-[11px] tabular-nums", value.length > HTML_CODE_MAX ? "text-destructive" : "text-muted-foreground")}>
            {value.length.toLocaleString("pt-BR")} / {HTML_CODE_MAX.toLocaleString("pt-BR")}
          </span>
        </div>

        <textarea
          key={tab}
          aria-label={`Código ${TABS.find((entry) => entry.id === tab)?.label}`}
          value={value}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          maxLength={HTML_CODE_MAX + 1000}
          onChange={(event) => onChange(tab, event.target.value)}
          onKeyDown={(event) => {
            // Tab insere recuo em vez de sair do campo (Esc + Tab continua saindo)
            if (event.key !== "Tab" || event.shiftKey) return;
            event.preventDefault();
            const field = event.currentTarget;
            const { selectionStart, selectionEnd } = field;
            onChange(tab, `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`);
            requestAnimationFrame(() => field.setSelectionRange(selectionStart + 2, selectionStart + 2));
          }}
          className="min-h-0 flex-1 resize-none rounded-md border border-border bg-background p-3 font-mono text-[12px] leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </DialogContent>
    </Dialog>
  );
};
