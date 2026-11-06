"use client";

import {
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarDays,
  Calculator,
  CaseSensitive,
  Columns3,
  Combine,
  Copy,
  Database,
  Eraser,
  Filter,
  Hash,
  ListChecks,
  ListFilter,
  Merge,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Percent,
  RefreshCw,
  Replace,
  Rows3,
  Save,
  Search,
  Sigma,
  Split,
  Table2,
  TableProperties,
  Trash2,
  Type,
  type LucideIcon,
  Code2,
  FunctionSquare,
  ListOrdered,
  Layers,
  SquareDashed,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Step, StepType } from "@/lib/domain/transform";
import { cn } from "@/lib/utils";
import type { StepDialogMode } from "./step-dialog";

export type TabId = "inicio" | "transformar" | "adicionar" | "exibir";

const TABS: { id: TabId; label: string }[] = [
  { id: "inicio", label: "Início" },
  { id: "transformar", label: "Transformar" },
  { id: "adicionar", label: "Adicionar coluna" },
  { id: "exibir", label: "Exibir" },
];

export type PanelKey = "queries" | "formula" | "steps" | "status" | "sql";

/** O que a faixa de opções precisa para executar os comandos. */
export type RibbonContext = {
  /** Coluna selecionada na grade. */
  column: string | null;
  hasQuery: boolean;
  canSave: boolean;
  shown: Record<PanelKey, boolean>;
  view: "grade" | "esquema";
  open: (mode: StepDialogMode) => void;
  add: (step: Step) => void;
  newQuery: () => void;
  refresh: () => void;
  save: () => void;
  togglePanel: (panel: PanelKey) => void;
  setView: (view: "grade" | "esquema") => void;
};

type Command = {
  id: string;
  label: string;
  icon: LucideIcon;
  tab: TabId;
  group: string;
  /** Mensagem de por que o botão está desligado; `null` quando pode usar. */
  disabled?: (ctx: RibbonContext) => string | null;
  active?: (ctx: RibbonContext) => boolean;
  run: (ctx: RibbonContext) => void;
};

const withId = (step: { type: StepType; [key: string]: unknown }) => ({ ...step, id: crypto.randomUUID() }) as unknown as Step;

const needsQuery = (ctx: RibbonContext) => (ctx.hasQuery ? null : "Abra uma consulta primeiro");
const needsColumn = (ctx: RibbonContext) => needsQuery(ctx) ?? (ctx.column ? null : "Selecione uma coluna na grade");

/** Abre o formulário da etapa; se há coluna selecionada, já vem preenchida. */
const form =
  (type: StepType, preset: (column: string | null) => Partial<Step> = () => ({})) =>
  (ctx: RibbonContext) =>
    ctx.open({ kind: "new", type, preset: preset(ctx.column) });

const onColumn = (key: string) => (column: string | null) => (column ? ({ [key]: column } as Partial<Step>) : {});

export const COMMANDS: Command[] = [
  // Início
  { id: "obter", label: "Obter dados", icon: Database, tab: "inicio", group: "Nova consulta", run: (ctx) => ctx.newQuery() },
  { id: "atualizar", label: "Atualizar", icon: RefreshCw, tab: "inicio", group: "Nova consulta", disabled: needsQuery, run: (ctx) => ctx.refresh() },
  { id: "escolher", label: "Escolher colunas", icon: Columns3, tab: "inicio", group: "Gerenciar colunas", disabled: needsQuery, run: form("escolher") },
  { id: "remover-col", label: "Remover colunas", icon: Trash2, tab: "inicio", group: "Gerenciar colunas", disabled: needsQuery, run: form("remover", (c) => (c ? { columns: [c] } : {})) },
  { id: "manter-linhas", label: "Manter linhas", icon: Rows3, tab: "inicio", group: "Reduzir linhas", disabled: needsQuery, run: form("limitar", () => ({ mode: "manter" })) },
  { id: "remover-linhas", label: "Remover linhas", icon: Eraser, tab: "inicio", group: "Reduzir linhas", disabled: needsQuery, run: form("limitar", () => ({ mode: "remover" })) },
  { id: "remover-nulos", label: "Remover nulos", icon: SquareDashed, tab: "inicio", group: "Reduzir linhas", disabled: needsQuery, run: form("remover_nulos", (c) => (c ? { columns: [c] } : {})) },
  { id: "duplicadas", label: "Remover duplicadas", icon: Copy, tab: "inicio", group: "Reduzir linhas", disabled: needsQuery, run: form("duplicadas", (c) => (c ? { columns: [c] } : {})) },
  {
    id: "ordenar-asc",
    label: "Crescente",
    icon: ArrowDownAZ,
    tab: "inicio",
    group: "Classificar",
    disabled: needsColumn,
    run: (ctx) => ctx.add(withId({ type: "ordenar", column: ctx.column!, dir: "asc" })),
  },
  {
    id: "ordenar-desc",
    label: "Decrescente",
    icon: ArrowUpAZ,
    tab: "inicio",
    group: "Classificar",
    disabled: needsColumn,
    run: (ctx) => ctx.add(withId({ type: "ordenar", column: ctx.column!, dir: "desc" })),
  },
  { id: "filtrar", label: "Filtrar linhas", icon: Filter, tab: "inicio", group: "Transformar", disabled: needsQuery, run: form("filtrar", onColumn("column")) },
  { id: "filtrar-valores", label: "Filtrar valores", icon: ListFilter, tab: "inicio", group: "Transformar", disabled: needsQuery, run: form("filtrar_valores", onColumn("column")) },
  { id: "agrupar", label: "Agrupar por", icon: Layers, tab: "inicio", group: "Transformar", disabled: needsQuery, run: form("agrupar", (c) => (c ? { by: [c] } : {})) },
  { id: "tipo", label: "Tipo de dados", icon: Type, tab: "inicio", group: "Transformar", disabled: needsQuery, run: form("tipo", onColumn("column")) },
  { id: "substituir-inicio", label: "Substituir valores", icon: Replace, tab: "inicio", group: "Transformar", disabled: needsQuery, run: form("substituir", onColumn("column")) },
  { id: "mesclar", label: "Mesclar consultas", icon: Merge, tab: "inicio", group: "Combinar", disabled: needsQuery, run: form("mesclar") },
  { id: "acrescentar", label: "Acrescentar consultas", icon: Combine, tab: "inicio", group: "Combinar", disabled: needsQuery, run: form("acrescentar") },
  {
    id: "salvar",
    label: "Salvar como dataset",
    icon: Save,
    tab: "inicio",
    group: "Salvar",
    disabled: (ctx) => (ctx.canSave ? null : "Aplique ao menos uma etapa, sem erros"),
    run: (ctx) => ctx.save(),
  },

  // Transformar
  { id: "renomear", label: "Renomear", icon: CaseSensitive, tab: "transformar", group: "Colunas", disabled: needsQuery, run: form("renomear", onColumn("from")) },
  { id: "tipo2", label: "Tipo de dados", icon: Type, tab: "transformar", group: "Colunas", disabled: needsQuery, run: form("tipo", onColumn("column")) },
  { id: "dividir", label: "Dividir coluna", icon: Split, tab: "transformar", group: "Colunas", disabled: needsQuery, run: form("dividir", onColumn("column")) },
  { id: "texto", label: "Formatar texto", icon: CaseSensitive, tab: "transformar", group: "Texto", disabled: needsQuery, run: form("texto", onColumn("column")) },
  { id: "substituir", label: "Substituir valores", icon: Replace, tab: "transformar", group: "Texto", disabled: needsQuery, run: form("substituir", onColumn("column")) },
  { id: "arredondar", label: "Arredondar", icon: Percent, tab: "transformar", group: "Número", disabled: needsQuery, run: form("arredondar", onColumn("column")) },
  { id: "preencher", label: "Preencher nulos", icon: ListChecks, tab: "transformar", group: "Qualidade", disabled: needsQuery, run: form("preencher", onColumn("column")) },
  { id: "agrupar2", label: "Agrupar por", icon: Layers, tab: "transformar", group: "Resumir", disabled: needsQuery, run: form("agrupar", (c) => (c ? { by: [c] } : {})) },
  { id: "dinamizar", label: "Dinamizar coluna", icon: TableProperties, tab: "transformar", group: "Resumir", disabled: needsQuery, run: form("dinamizar", onColumn("column")) },

  // Adicionar coluna
  { id: "condicional", label: "Coluna condicional", icon: FunctionSquare, tab: "adicionar", group: "Geral", disabled: needsQuery, run: form("condicional", onColumn("column")) },
  { id: "indice", label: "Coluna de índice", icon: ListOrdered, tab: "adicionar", group: "Geral", disabled: needsQuery, run: form("indice") },
  { id: "calcular", label: "Coluna calculada", icon: Calculator, tab: "adicionar", group: "Número", disabled: needsQuery, run: form("calcular", onColumn("left")) },
  { id: "arredondar2", label: "Arredondar", icon: Hash, tab: "adicionar", group: "Número", disabled: needsQuery, run: form("arredondar", onColumn("column")) },
  { id: "data-parte", label: "Parte da data", icon: CalendarDays, tab: "adicionar", group: "Data", disabled: needsQuery, run: form("data_parte", onColumn("column")) },

  // Exibir
  { id: "ver-consultas", label: "Painel de consultas", icon: PanelLeft, tab: "exibir", group: "Layout", active: (ctx) => ctx.shown.queries, run: (ctx) => ctx.togglePanel("queries") },
  { id: "ver-formula", label: "Barra de fórmula", icon: Sigma, tab: "exibir", group: "Layout", active: (ctx) => ctx.shown.formula, run: (ctx) => ctx.togglePanel("formula") },
  { id: "ver-etapas", label: "Etapas aplicadas", icon: PanelRight, tab: "exibir", group: "Layout", active: (ctx) => ctx.shown.steps, run: (ctx) => ctx.togglePanel("steps") },
  { id: "ver-status", label: "Barra de status", icon: PanelBottom, tab: "exibir", group: "Layout", active: (ctx) => ctx.shown.status, run: (ctx) => ctx.togglePanel("status") },
  { id: "ver-grade", label: "Grade de dados", icon: Table2, tab: "exibir", group: "Visão", active: (ctx) => ctx.view === "grade", run: (ctx) => ctx.setView("grade") },
  { id: "ver-esquema", label: "Esquema das colunas", icon: Columns3, tab: "exibir", group: "Visão", active: (ctx) => ctx.view === "esquema", run: (ctx) => ctx.setView("esquema") },
  { id: "ver-sql", label: "Ver SQL completo", icon: Code2, tab: "exibir", group: "Visão", disabled: needsQuery, active: (ctx) => ctx.shown.sql, run: (ctx) => ctx.togglePanel("sql") },
];

const RibbonButton = ({ command, ctx }: { command: Command; ctx: RibbonContext }) => {
  const Icon = command.icon;
  const reason = command.disabled?.(ctx) ?? null;
  const active = command.active?.(ctx) ?? false;
  return (
    <button
      type="button"
      disabled={reason !== null}
      title={reason ?? command.label}
      aria-pressed={command.active ? active : undefined}
      onClick={() => command.run(ctx)}
      className={cn(
        "flex h-[58px] w-[68px] shrink-0 flex-col items-center justify-start gap-1 rounded-md px-1 pt-1.5 text-[11px] leading-tight text-foreground transition-colors outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
        active && "bg-primary/10 text-primary",
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      <span className="line-clamp-2 text-center">{command.label}</span>
    </button>
  );
};

/** Pesquisa de comandos (Alt + Q), como no Power Query. */
const CommandSearch = ({ ctx }: { ctx: RibbonContext }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === "q") {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const text = query.trim().toLowerCase();
    return text ? COMMANDS.filter((command) => command.label.toLowerCase().includes(text) || command.group.toLowerCase().includes(text)).slice(0, 8) : [];
  }, [query]);

  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        ref={input}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setQuery("");
            input.current?.blur();
          }
          if (event.key === "Enter" && results[0] && !(results[0].disabled?.(ctx) ?? null)) {
            results[0].run(ctx);
            setQuery("");
          }
        }}
        placeholder="Pesquisar (Alt + Q)"
        aria-label="Pesquisar comandos"
        className="h-8 w-full rounded-md border border-input bg-background pr-2 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
      />
      {open && query.trim() ? (
        <ul role="listbox" className="absolute top-9 right-0 left-0 z-40 overflow-hidden rounded-lg bg-popover py-1 text-sm shadow-lg ring-1 ring-foreground/10">
          {results.length === 0 ? <li className="px-3 py-2 text-xs text-muted-foreground">Nenhum comando encontrado.</li> : null}
          {results.map((command) => {
            const reason = command.disabled?.(ctx) ?? null;
            const Icon = command.icon;
            return (
              <li key={command.id}>
                <button
                  type="button"
                  disabled={reason !== null}
                  title={reason ?? undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    command.run(ctx);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <Icon className="size-4 text-muted-foreground" aria-hidden />
                  <span className="flex-1">{command.label}</span>
                  <span className="text-[10px] text-muted-foreground">{command.group}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};

/** Faixa de opções com abas e botões agrupados (Início, Transformar, Adicionar coluna e Exibir). */
export const Ribbon = ({ ctx }: { ctx: RibbonContext }) => {
  const [tab, setTab] = useState<TabId>("inicio");

  const groups = useMemo(() => {
    const byGroup = new Map<string, Command[]>();
    for (const command of COMMANDS.filter((entry) => entry.tab === tab)) {
      byGroup.set(command.group, [...(byGroup.get(command.group) ?? []), command]);
    }
    return [...byGroup.entries()];
  }, [tab]);

  return (
    <div className="shrink-0 border-b border-border bg-card/60">
      <div className="flex items-center gap-1 px-3 pt-1">
        <div role="tablist" aria-label="Faixa de opções" className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => setTab(entry.id)}
              className={cn(
                "h-8 shrink-0 border-b-2 px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                tab === entry.id ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <div className="ms-auto flex w-full max-w-xs justify-end">
          <CommandSearch ctx={ctx} />
        </div>
      </div>

      <div role="tabpanel" className="flex min-h-[84px] items-stretch gap-0 overflow-x-auto px-2 pb-1">
        {groups.map(([group, commands]) => (
          <div key={group} className="flex shrink-0 flex-col border-r border-border/60 px-1 last:border-r-0">
            <div className="flex flex-1 items-start gap-0.5">
              {commands.map((command) => (
                <RibbonButton key={command.id} command={command} ctx={ctx} />
              ))}
            </div>
            <span className="pb-0.5 text-center text-[10px] text-muted-foreground">{group}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
