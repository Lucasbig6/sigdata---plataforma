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
import { useSession } from "@/lib/auth-client";
import { useNotebooksStore } from "@/lib/notebooks/store";
import { GettingStarted } from "./getting-started";
import { NewProjectTile, NotebookCard } from "./notebook-card";
import { QuickActions } from "./quick-actions";
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

  const { data: session } = useSession();
  const firstName = session?.user.name.trim().split(/\s+/)[0] ?? "";

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

  const showHeaderCreate = hydrated && items.length > 0 && (view === "list" || query.trim() !== "");

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

      <main className="px-4 py-8 sm:px-10 sm:py-10 lg:px-30">
        <div className="flex items-end justify-between gap-5 pb-8">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
              {firstName ? `Olá, ${firstName}` : "Seus projetos"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Continue de onde parou ou comece um novo projeto.</p>
          </div>
          {/* na grade, o primeiro cartão já cria projetos; no vazio, o botão está no aviso */}
          {showHeaderCreate ? (
            <Button onClick={openCreate} className="shrink-0">
              <Plus aria-hidden />
              Novo projeto
            </Button>
          ) : null}
        </div>

        {hydrated && !loadError && !query.trim() ? <QuickActions /> : null}

        <GettingStarted />

        {!hydrated ? (
          <CardSkeletons
            count={view === "grid" ? 5 : 4}
            className={view === "grid" ? "lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1 gap-2.5"}
            itemClassName={view === "grid" ? "aspect-[3/2] h-auto rounded-2xl" : "h-16 rounded-xl"}
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
            {!query.trim() ? <NewProjectTile onClick={openCreate} /> : null}
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
          <div className="flex flex-col gap-2">
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
