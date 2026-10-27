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
import { cn } from "@/lib/utils";
import { NotebookCard } from "./notebook-card";
import { NotebooksHeader } from "./notebooks-header";

export const NotebooksHome = () => {
  const hydrated = useNotebooksStore((state) => state.hydrated);
  const hydrate = useNotebooksStore((state) => state.hydrate);
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

      <main className="mx-auto px-30 py-6">
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
          <div
            className={cn(
              view === "grid"
                ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "flex flex-col gap-2.5",
            )}
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  "animate-pulse rounded-2xl bg-muted/50",
                  view === "grid" ? "aspect-[5/4]" : "h-20 rounded-xl",
                )}
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 px-6 py-20 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-muted/60 text-muted-foreground">
              <BookOpen className="size-5" aria-hidden />
            </span>
            <p className="text-sm font-medium text-foreground">
              {query.trim() ? "Nenhum projeto encontrado" : "Nenhum projeto ainda"}
            </p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              {query.trim()
                ? "Tente buscar por outro título."
                : "Crie um projeto para começar a conversar com seus dados e transformar perguntas em análises."}
            </p>
            {!query.trim() && (
              <Button onClick={openCreate} className="mt-1 cursor-pointer">
                <Plus aria-hidden />
                Novo projeto
              </Button>
            )}
          </div>
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
