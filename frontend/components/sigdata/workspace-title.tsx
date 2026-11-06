"use client";

import { useEffect, useRef, useState } from "react";
import { useNotebooksStore } from "@/lib/notebooks/store";
import { useNotebookId } from "@/lib/use-notebook-id";

/** Cabeçalho do workspace: nome do projeto (editável ali mesmo); a fonte ativa fica no seletor "Dados". */
export const WorkspaceTitle = ({ fallback }: { fallback: string }) => {
  const notebookId = useNotebookId();
  const notebook = useNotebooksStore((state) => state.notebooks.find((entry) => entry.id === notebookId));
  const renameNotebook = useNotebooksStore((state) => state.renameNotebook);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const finished = useRef(false);

  useEffect(() => {
    if (!editing) return;
    finished.current = false;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  if (!notebook) {
    return <h1 className="truncate text-sm font-medium text-foreground">{fallback}</h1>;
  }

  const commit = () => {
    if (finished.current) return;
    finished.current = true;
    setEditing(false);
    const next = draft.trim();
    if (next && next !== notebook.title) renameNotebook(notebook.id, next);
  };

  return (
    <>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          maxLength={120}
          aria-label="Nome do projeto"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") {
              finished.current = true;
              setEditing(false);
            }
          }}
          className="h-8 min-w-0 max-w-sm flex-1 rounded-md border border-ring bg-background px-2 text-sm font-medium text-foreground outline-none ring-2 ring-ring/30"
        />
      ) : (
        <h1 className="min-w-0 truncate">
          <button
            type="button"
            title="Clique para renomear"
            onClick={() => {
              setDraft(notebook.title);
              setEditing(true);
            }}
            className="max-w-full truncate rounded-md px-1.5 py-1 text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {notebook.title}
          </button>
        </h1>
      )}
    </>
  );
};
