"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ResultColumn, SourceTable } from "@/lib/domain/sources";
import { STEP_LABELS, type Step, type StepType } from "@/lib/domain/transform";
import { usePreparoStore } from "@/lib/preparo/store";
import { Field } from "./form-fields";
import { defaultStep, STEP_TYPE_GROUPS, StepForm, stepProblem, type FormContext } from "./step-forms";

export type StepDialogMode =
  | { kind: "new"; type: StepType; preset?: Partial<Step> }
  | { kind: "edit"; step: Step; index: number };

/**
 * Cria ou edita uma etapa. As colunas oferecidas são as do resultado *antes* da etapa,
 * buscadas no servidor, para que editar uma etapa do meio enxergue só o que existia ali.
 */
export const StepDialog = ({
  mode,
  tables,
  currentTable,
  onClose,
}: {
  mode: StepDialogMode | null;
  tables: SourceTable[];
  currentTable: string;
  onClose: () => void;
}) => {
  const columnsAt = usePreparoStore((state) => state.columnsAt);
  const distinctValues = usePreparoStore((state) => state.distinctValues);
  const columnsOfQuery = usePreparoStore((state) => state.columnsOfQuery);
  const allQueries = usePreparoStore((state) => state.queries);
  const activeId = usePreparoStore((state) => state.activeId);
  const addStep = usePreparoStore((state) => state.addStep);
  const replaceStep = usePreparoStore((state) => state.replaceStep);

  const [columns, setColumns] = useState<ResultColumn[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Step | null>(null);
  const [touched, setTouched] = useState(false);

  const upTo = mode?.kind === "edit" ? mode.index : undefined;

  useEffect(() => {
    if (!mode) return;
    let cancelled = false;
    setColumns(null);
    setLoadError(null);
    setDraft(null);
    setTouched(false);
    columnsAt(upTo)
      .then((loaded) => {
        if (cancelled) return;
        setColumns(loaded);
        if (mode.kind === "edit") return setDraft(mode.step);
        const base = defaultStep(mode.type, {
          columns: loaded,
          tables,
          currentTable,
          queries: usePreparoStore.getState().queries.filter((query) => query.id !== usePreparoStore.getState().activeId),
          fetchValues: async () => ({ values: [], truncated: false }),
          fetchQueryColumns: async () => [],
        });
        setDraft({ ...base, ...mode.preset } as Step);
      })
      .catch((error: Error) => !cancelled && setLoadError(error.message));
    return () => {
      cancelled = true;
    };
    // recarrega só ao abrir uma etapa diferente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, columnsAt, upTo]);

  const fetchValues = useCallback((column: string) => distinctValues(column, upTo), [distinctValues, upTo]);
  const queries = useMemo(
    () => allQueries.filter((query) => query.id !== activeId).map((query) => ({ id: query.id, name: query.name })),
    [allQueries, activeId],
  );
  const ctx = useMemo<FormContext | null>(
    () => (columns ? { columns, tables, currentTable, queries, fetchValues, fetchQueryColumns: columnsOfQuery } : null),
    [columns, tables, currentTable, queries, fetchValues, columnsOfQuery],
  );

  const problem = draft ? stepProblem(draft) : null;

  const submit = () => {
    if (!draft) return;
    setTouched(true);
    if (problem) return;
    if (mode?.kind === "edit") replaceStep(draft.id, draft);
    else addStep(draft);
    onClose();
  };

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode?.kind === "edit" ? `Editar: ${STEP_LABELS[mode.step.type]}` : "Nova etapa"}</DialogTitle>
          <DialogDescription>
            {mode?.kind === "edit"
              ? `Editando a etapa ${mode.index + 1}. As etapas seguintes são conferidas de novo.`
              : "A etapa entra no fim da lista e a prévia já mostra o resultado."}
          </DialogDescription>
        </DialogHeader>

        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : !draft || !ctx ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Carregando colunas…
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {mode?.kind === "new" ? (
              <Field label="Tipo de etapa">
                <select
                  value={draft.type}
                  onChange={(event) => setDraft(defaultStep(event.target.value as StepType, ctx))}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  {STEP_TYPE_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.types.map((type) => (
                        <option key={type} value={type}>
                          {STEP_LABELS[type]}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
            ) : null}
            <StepForm step={draft} ctx={ctx} onChange={setDraft} />
            {touched && problem ? <p className="text-xs text-destructive">{problem}</p> : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!draft || !ctx}>
            {mode?.kind === "edit" ? "Salvar etapa" : "Aplicar etapa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
