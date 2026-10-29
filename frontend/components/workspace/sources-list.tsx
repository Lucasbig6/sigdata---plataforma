"use client";

import { Check, Code2, Table2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCan } from "@/lib/auth-client";
import { useDatasetsStore } from "@/lib/datasets/store";
import { isWorkspaceSource } from "@/lib/domain/sources";
import { useNotebooksStore } from "@/lib/notebooks/store";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("pt-BR");

/**
 * Coluna "Fontes" do workspace (como no NotebookLM): os datasets do catálogo,
 * com o ativo marcado. O agente e as células SQL trabalham sobre ele.
 */
export const SourcesList = () => {
  const projectId = useSearchParams().get("notebook");
  const hydrated = useDatasetsStore((state) => state.hydrated);
  const datasets = useDatasetsStore((state) => state.datasets);
  const activeId = useNotebooksStore(
    (state) => state.notebooks.find((notebook) => notebook.id === projectId)?.sourceId ?? null,
  );
  const setNotebookSource = useNotebooksStore((state) => state.setNotebookSource);
  const canManageSources = useCan("analista");
  const ready = datasets.filter(isWorkspaceSource);

  return (
    <section aria-labelledby="fontes-titulo" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 id="fontes-titulo" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Fontes
        </h2>
        {hydrated ? <span className="text-[11px] tabular-nums text-muted-foreground">{ready.length}</span> : null}
      </div>

      {!hydrated ? (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-11 animate-pulse rounded-lg bg-muted/50" />
          ))}
        </div>
      ) : ready.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-2.5 py-3 text-xs leading-relaxed text-muted-foreground">
          Nenhum dataset disponível.{" "}
          {canManageSources ? (
            <Link href="/fontes-de-dados/editor" className="font-medium text-primary hover:underline">
              Criar no editor SQL
            </Link>
          ) : (
            "Peça a um analista para criar um."
          )}
        </p>
      ) : (
        <ul role="radiogroup" aria-label="Dataset ativo do projeto" className="flex flex-col gap-1">
          {ready.map((dataset) => {
            const active = dataset.id === activeId;
            const rows = dataset.tables.reduce((sum, table) => sum + (table.rowCount ?? 0), 0);
            return (
              <li key={dataset.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={!projectId}
                  onClick={() => projectId && setNotebookSource(projectId, active ? null : dataset.id)}
                  title={dataset.description || dataset.name}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60",
                    active
                      ? "border-primary/40 bg-primary/10"
                      : "border-transparent hover:border-border hover:bg-muted/50",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-md",
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {active ? <Check className="size-3.5" aria-hidden /> : <Table2 className="size-3.5" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{dataset.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {rows > 0 ? `${nf.format(rows)} linhas` : `${dataset.tables.length} tabela(s)`}
                      {dataset.definition?.sourceName ? ` · de ${dataset.definition.sourceName}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {canManageSources && ready.length > 0 ? (
        <Link
          href="/fontes-de-dados/editor"
          className="flex w-fit items-center gap-1.5 px-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Code2 className="size-3" aria-hidden />
          Novo dataset no editor SQL
        </Link>
      ) : null}
    </section>
  );
};
