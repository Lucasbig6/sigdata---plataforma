"use client";

import { BookOpen, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNotebooksStore } from "@/lib/notebooks/store";
import { cn } from "@/lib/utils";
import { NotebookCard } from "./notebook-card";
import { NotebooksHeader } from "./notebooks-header";

export const NotebooksHome = () => {
  const router = useRouter();
  const hydrated = useNotebooksStore((state) => state.hydrated);
  const hydrate = useNotebooksStore((state) => state.hydrate);
  const notebooks = useNotebooksStore((state) => state.notebooks);
  const createNotebook = useNotebooksStore((state) => state.createNotebook);
  const renameNotebook = useNotebooksStore((state) => state.renameNotebook);
  const deleteNotebook = useNotebooksStore((state) => state.deleteNotebook);

  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const items = useMemo(() => {
    const term = query.trim().toLowerCase();
    return notebooks
      .filter((notebook) => !term || notebook.title.toLowerCase().includes(term))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notebooks, query]);

  const handleCreate = () => {
    const id = createNotebook();
    router.push(`/workspace?notebook=${id}`);
  };

  return (
    <div className="min-h-dvh bg-background">
      <NotebooksHeader query={query} onQueryChange={setQuery} view={view} onViewChange={setView} />

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex items-center justify-between gap-3 pb-5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Projetos recentes
          </h1>
          <Button onClick={handleCreate}>
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
              <Button onClick={handleCreate} className="mt-1">
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
    </div>
  );
};
