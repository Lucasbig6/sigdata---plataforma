"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useDashboardsStore } from "@/lib/dashboards/store";
import type { DashboardMeasure } from "@/lib/dashboards/types";
import { MeasureDialog } from "./measure-dialog";

/** Medidas calculadas do painel: criar, editar e excluir. */
export const MeasuresPanel = () => {
  const store = useDashboardsStore.getState();
  const currentId = store.currentId;
  const dashboard = currentId ? store.dashboards[currentId] : undefined;
  const measures = currentId ? (dashboard?.measures ?? []) : [];
  const removeMeasure = (id: string) => useDashboardsStore.getState().removeMeasure(id);
  const [dialog, setDialog] = useState<{ open: boolean; initial?: DashboardMeasure }>({ open: false });

  return (
    <div className="flex flex-col gap-2">
      {measures.length === 0 ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Crie medidas como lucro ou margem uma vez e use em qualquer gráfico, tabela ou indicador.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {measures.map((measure) => (
            <li key={measure.id} className="flex items-center gap-1 rounded-md border border-border/60 px-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{measure.name}</p>
                <p className="truncate font-mono text-[10px] text-muted-foreground" title={measure.expr}>
                  {measure.expr}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Editar ${measure.name}`}
                onClick={() => setDialog({ open: true, initial: measure })}
                className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={`Excluir ${measure.name}`}
                onClick={() => {
                  if (window.confirm(`Excluir a medida "${measure.name}"? Elementos que já a usam continuam funcionando.`)) {
                    removeMeasure(measure.id);
                  }
                }}
                className="grid size-6 place-items-center rounded text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setDialog({ open: true })}
        className="flex items-center justify-center gap-1.5 rounded-md border border-border/70 px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/60"
      >
        <Plus className="size-3.5" aria-hidden />
        Nova medida
      </button>
      <MeasureDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        initial={dialog.initial}
      />
    </div>
  );
};
