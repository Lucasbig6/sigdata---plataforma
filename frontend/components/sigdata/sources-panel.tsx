"use client";

import { Check, Database, PanelLeftClose, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useRole } from "@/lib/auth-client";
import { DATASET_KIND_LABELS, isAnalysisDataset, useDatasetsStore } from "@/lib/datasets/store";
import { useNotebooksStore } from "@/lib/notebooks/store";
import { cn } from "@/lib/utils";
import { canManageData } from "@shared/roles";
import { ChatListItem } from "./chat-list-item";
import { LineSkeletons } from "./list-states";
import { SourceCard } from "./source-card";

/**
 * Painel "Fontes" (esquerda): os datasets que o projeto pode usar — o escolhido fica marcado —
 * e, abaixo, os projetos recentes para trocar de conversa.
 */
export const SourcesPanel = ({ onCollapse }: { onCollapse?: () => void }) => {
  const router = useRouter();
  const notebookId = useSearchParams().get("notebook");
  const role = useRole();

  const datasetsHydrated = useDatasetsStore((state) => state.hydrated);
  const hydrateDatasets = useDatasetsStore((state) => state.hydrate);
  const datasets = useDatasetsStore((state) => state.datasets);
  const notebooksHydrated = useNotebooksStore((state) => state.hydrated);
  const hydrateNotebooks = useNotebooksStore((state) => state.hydrate);
  const notebooks = useNotebooksStore((state) => state.notebooks);
  const createNotebook = useNotebooksStore((state) => state.createNotebook);
  const renameNotebook = useNotebooksStore((state) => state.renameNotebook);
  const deleteNotebook = useNotebooksStore((state) => state.deleteNotebook);
  const setNotebookSource = useNotebooksStore((state) => state.setNotebookSource);

  useEffect(() => {
    hydrateDatasets();
    hydrateNotebooks();
  }, [hydrateDatasets, hydrateNotebooks]);

  const active = notebooks.find((notebook) => notebook.id === notebookId) ?? null;
  const selectedId = active?.sourceId ?? null;
  const ready = datasets.filter(isAnalysisDataset);
  const selectedDataset = datasets.find((dataset) => dataset.id === selectedId && dataset.status === "pronta") ?? null;
  const canManage = canManageData(role ?? "usuario");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">Fontes</h2>
        {onCollapse ? (
          <Button variant="ghost" size="icon-sm" onClick={onCollapse} aria-label="Recolher fontes" title="Recolher fontes">
            <PanelLeftClose className="size-4" aria-hidden />
          </Button>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {canManage ? (
          <Button
            variant="outline"
            className="mb-2 h-9 w-full justify-center gap-1.5 rounded-xl"
            render={<Link href="/fontes-de-dados" />}
            nativeButton={false}
          >
            <Plus className="size-4" aria-hidden />
            Gerenciar fontes
          </Button>
        ) : null}

        {!datasetsHydrated ? (
          <LineSkeletons />
        ) : ready.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
            <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
              <Database className="size-5" aria-hidden />
            </span>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {canManage
                ? "Nenhum dataset ainda. Crie um no editor SQL a partir de uma fonte."
                : "Nenhum dataset publicado ainda. Peça a um analista."}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1" aria-label="Datasets disponíveis">
            {ready.map((dataset) => {
              const selected = dataset.id === selectedId;
              return (
                <li key={dataset.id}>
                  <button
                    type="button"
                    disabled={!active}
                    aria-pressed={selected}
                    onClick={() => active && setNotebookSource(active.id, selected ? null : dataset.id)}
                    title={active ? (selected ? "Clique para desmarcar" : "Usar neste projeto") : "Abra um projeto primeiro"}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-start text-sm outline-none transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60",
                      selected ? "bg-primary/10 text-foreground" : "text-foreground hover:bg-muted/70",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-md border",
                        selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                      )}
                      aria-hidden
                    >
                      {selected ? <Check className="size-3.5" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{dataset.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {DATASET_KIND_LABELS[dataset.kind]} · {dataset.tables.length} tabela(s)
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {selectedDataset ? (
          <div className="mt-3">
            <SourceCard source={selectedDataset} />
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between px-1 pb-1.5">
          <h3 className="text-xs font-medium text-muted-foreground">Projetos recentes</h3>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Novo projeto"
            title="Novo projeto"
            onClick={() => router.push(`/workspace?notebook=${createNotebook()}`)}
          >
            <Plus className="size-3.5" aria-hidden />
          </Button>
        </div>
        {!notebooksHydrated ? (
          <LineSkeletons />
        ) : notebooks.length === 0 ? (
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">Nenhum projeto ainda.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {notebooks.map((notebook) => {
              const isActive = notebook.id === notebookId;
              return (
                <li key={notebook.id}>
                  <ChatListItem
                    title={notebook.title}
                    active={isActive}
                    onOpen={() => router.push(`/workspace?notebook=${notebook.id}`)}
                    onRename={(title) => renameNotebook(notebook.id, title)}
                    onDelete={() => {
                      deleteNotebook(notebook.id);
                      if (!isActive) return;
                      // excluiu a conversa aberta: abre outra, ou cria uma nova se não sobrou nenhuma
                      const next = notebooks.find((entry) => entry.id !== notebook.id);
                      router.push(`/workspace?notebook=${next ? next.id : createNotebook()}`);
                    }}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
