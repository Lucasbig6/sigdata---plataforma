"use client";

import { PanelLeft, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { useHtmlRuntime } from "@/lib/dashboards/html-runtime";
import { HtmlAgentPanel } from "./agent/html-agent-panel";
import { HtmlElement } from "./html-element";
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
  elementId,
  code,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  elementId: string;
  code: Code;
  onChange: (lang: Lang, value: string) => void;
}) => {
  const [tab, setTab] = useState<Lang>("html");
  const [agentOpen, setAgentOpen] = useState(true);
  const value = code[tab];
  const element = useDashboardsStore((state) => state.current()?.elements.find((entry) => entry.id === elementId));
  const errors = useHtmlRuntime((state) => state.errors[elementId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(90dvh,52rem)] w-[min(96rem,calc(100vw-2rem))] max-w-none flex-col gap-3 sm:max-w-none">
        <DialogHeader>
          <DialogTitle>Código do visual</DialogTitle>
          <DialogDescription>
            Roda isolado: sem acesso à sua sessão, à API nem à rede. Os dados da ligação chegam em{" "}
            <code className="font-mono">sigdata.rows</code> e <code className="font-mono">sigdata.columns</code>; use{" "}
            <code className="font-mono">sigdata.onData(fn)</code> para redesenhar quando mudarem e{" "}
            <code className="font-mono">sigdata.select(coluna, valor)</code> para filtrar os outros elementos. Bibliotecas: cdnjs, jsDelivr e unpkg.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 gap-3">
          {agentOpen ? (
            <section aria-label="Agente de código" className="hidden min-h-0 w-80 shrink-0 overflow-hidden rounded-lg border border-border lg:block">
              <HtmlAgentPanel elementId={elementId} />
            </section>
          ) : null}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
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
            <button
            type="button"
            onClick={() => setAgentOpen((visible) => !visible)}
            aria-pressed={agentOpen}
            title="Mostrar ou ocultar o agente"
            className={cn(
              "ml-auto hidden items-center gap-1 rounded-md px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:inline-flex",
              agentOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60",
            )}
          >
            <PanelLeft className="size-3.5" aria-hidden />
            Agente
          </button>
          <span className={cn("self-center text-[11px] tabular-nums", value.length > HTML_CODE_MAX ? "text-destructive" : "text-muted-foreground")}>
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
          </div>

          <section aria-label="Prévia" className="hidden min-h-0 w-[34%] shrink-0 flex-col gap-2 xl:flex">
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-panel">
              {element?.type === "html" ? (
                <HtmlElement element={element} interactive empty="Escreva ou peça um código para ver a prévia aqui." />
              ) : null}
            </div>
            {errors && errors.length > 0 ? (
              <ul className="max-h-24 shrink-0 space-y-1 overflow-auto rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive" aria-label="Erros do código">
                {errors.map((message) => (
                  <li key={message} className="flex gap-1.5">
                    <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
                    <span className="break-words">{message}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
