"use client";

import { BookOpen, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useNotebooksStore } from "@/lib/notebooks/store";
import { GettingStarted } from "./getting-started";
import { NotebookCard } from "./notebook-card";
import { NotebooksHeader } from "./notebooks-header";
import { CardSkeletons, EmptyState, ErrorState } from "./list-states";

export const NotebooksHome = () => {
  const hydrated = useNotebooksStore((state) => state.hydrated);
  const hydrate = useNotebooksStore((state) => state.hydrate);
  const loadError = useNotebooksStore((state) => state.error);
  const notebooks = useNotebooksStore((state) => state.notebooks);
  const createNotebook = useNotebooksStore((state) => state.createNotebook);
  const renameNotebook = useNotebooksStore((state) => state.renameNotebook);
  const deleteNotebook = useNotebooksStore((state) => state.deleteNotebook);

  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [createOpen, setCreateOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const items = useMemo(() => {
    const term = query.trim().toLowerCase();
    return notebooks
      .filter((notebook) => !term || notebook.title.toLowerCase().includes(term))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notebooks, query]);

  const openCreate = () => {
    setDraftTitle("");
    setCreateOpen(true);
  };

  const submitCreate = () => {
    createNotebook(draftTitle);
    setCreateOpen(false);
  };

  return (
    <div className="min-h-dvh bg-background">
      <NotebooksHeader query={query} onQueryChange={setQuery} view={view} onViewChange={setView} />

      <main className="mx-auto px-4 sm:px-10 lg:px-30 py-6">
        <GettingStarted />
        <div className="flex items-center justify-between gap-5 pb-10">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Projetos recentes
          </h1>
          <Button onClick={openCreate} className="flex items-center gap-1.5 cursor-pointer">
            <Plus aria-hidden />
            Novo projeto
          </Button>
        </div>

        {!hydrated ? (
          <CardSkeletons
            className={view === "grid" ? undefined : "grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1 gap-2.5"}
            itemClassName={view === "grid" ? "aspect-[5/4] h-auto" : "h-20 rounded-xl"}
          />
        ) : loadError ? (
          <ErrorState title="Não foi possível carregar seus projetos" message={loadError} onRetry={hydrate} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={query.trim() ? "Nenhum projeto encontrado" : "Nenhum projeto ainda"}
            description={
              query.trim()
                ? "Tente buscar por outro título."
                : "Crie um projeto para começar a conversar com seus dados e transformar perguntas em análises."
            }
            action={
              query.trim() ? undefined : (
                <Button onClick={openCreate}>
                  <Plus aria-hidden />
                  Novo projeto
                </Button>
              )
            }
          />
        ) : view === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((notebook, index) => (
              <NotebookCard
                key={notebook.id}
                notebook={notebook}
                view="grid"
                index={index}
                onRename={renameNotebook}
                onDelete={deleteNotebook}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {items.map((notebook, index) => (
              <NotebookCard
                key={notebook.id}
                notebook={notebook}
                view="list"
                index={index}
                onRename={renameNotebook}
                onDelete={deleteNotebook}
              />
            ))}
          </div>
        )}
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
          </DialogHeader>
          <Input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitCreate();
            }}
            placeholder="Nome do projeto"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submitCreate} disabled={!draftTitle.trim()}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
