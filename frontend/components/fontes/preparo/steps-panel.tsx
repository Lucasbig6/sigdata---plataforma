"use client";

import { ArrowDown, ArrowUp, Database, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STEP_LABELS, type Step, type StepType } from "@/lib/domain/transform";
import { describeStep } from "@/lib/preparo/describe";
import { cn } from "@/lib/utils";
import { STEP_TYPE_GROUPS } from "./step-forms";

/** "Etapas aplicadas": clicar numa etapa mostra os dados até ali; editar, mover e apagar revalidam as seguintes. */
export const StepsPanel = ({
  queryName,
  origin,
  onRename,
  table,
  steps,
  applied,
  errorIndex,
  onView,
  onAdd,
  onEdit,
  onRemove,
  onMove,
}: {
  queryName: string;
  /** Fonte e tabela de onde a consulta lê (somente leitura). */
  origin: string;
  onRename: (name: string) => void;
  table: string;
  steps: Step[];
  /** Quantas etapas a prévia aplica agora. */
  applied: number;
  /** Índice da etapa que falhou, se alguma. */
  errorIndex: number | null;
  onView: (applied: number) => void;
  onAdd: (type: StepType) => void;
  onEdit: (index: number) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, delta: -1 | 1) => void;
}) => (
  <aside className="flex min-h-0 w-full shrink-0 flex-col border-t border-border bg-card/40 lg:w-80 lg:border-t-0 lg:border-l" aria-label="Etapas aplicadas">
    <div className="shrink-0 border-b border-border px-3 py-2">
      <h2 className="mb-1.5 text-sm font-semibold">Configurações da consulta</h2>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-muted-foreground">Nome</span>
        <input
          key={queryName}
          defaultValue={queryName}
          maxLength={120}
          onBlur={(event) => (event.target.value.trim() ? onRename(event.target.value) : (event.target.value = queryName))}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </label>
      <p className="mt-1.5 truncate text-[11px] text-muted-foreground" title={origin}>
        Origem: {origin}
      </p>
    </div>
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
      <h2 className="text-sm font-semibold">Etapas aplicadas</h2>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Plus className="size-3.5" aria-hidden />
          Nova etapa
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {STEP_TYPE_GROUPS.map((group, index) => (
            <div key={group.label}>
              {index > 0 ? <DropdownMenuSeparator /> : null}
              <p className="px-2 py-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{group.label}</p>
              {group.types.map((type) => (
                <DropdownMenuItem key={type} onClick={() => onAdd(type)}>
                  {STEP_LABELS[type]}
                </DropdownMenuItem>
              ))}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <ol className="min-h-0 flex-1 overflow-y-auto p-2 text-sm">
      <li>
        <button
          type="button"
          onClick={() => onView(0)}
          aria-current={applied === 0}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/60",
            applied === 0 && "bg-primary/10 text-foreground",
          )}
        >
          <Database className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0">
            <span className="block truncate font-medium">Fonte</span>
            <span className="block truncate font-mono text-[11px] text-muted-foreground">{table}</span>
          </span>
        </button>
      </li>

      {steps.map((step, index) => {
        const active = applied === index + 1;
        const notApplied = index >= applied;
        const failed = errorIndex === index;
        return (
          <li key={step.id} className="group relative">
            <div
              className={cn(
                "flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60",
                active && "bg-primary/10",
                failed && "bg-destructive/10 ring-1 ring-destructive/40",
                notApplied && !failed && "opacity-50",
              )}
            >
              <button
                type="button"
                onClick={() => onView(index + 1)}
                aria-current={active}
                className="flex min-w-0 flex-1 items-start gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-muted text-[10px] tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{STEP_LABELS[step.type]}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{describeStep(step)}</span>
                </span>
              </button>
              <span className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <Button size="icon-xs" variant="ghost" aria-label="Editar etapa" title="Editar" onClick={() => onEdit(index)}>
                  <Pencil aria-hidden />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Mover para cima"
                  title="Mover para cima"
                  disabled={index === 0}
                  onClick={() => onMove(step.id, -1)}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Mover para baixo"
                  title="Mover para baixo"
                  disabled={index === steps.length - 1}
                  onClick={() => onMove(step.id, 1)}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button size="icon-xs" variant="ghost" aria-label="Apagar etapa" title="Apagar" onClick={() => onRemove(step.id)}>
                  <Trash2 aria-hidden />
                </Button>
              </span>
            </div>
          </li>
        );
      })}

      {steps.length === 0 ? (
        <li className="px-2 py-4 text-xs text-muted-foreground">
          Nenhuma etapa ainda. Abra o menu de uma coluna na grade ou use <strong>Nova etapa</strong> para filtrar, renomear,
          agrupar e mais.
        </li>
      ) : null}
    </ol>
  </aside>
);
