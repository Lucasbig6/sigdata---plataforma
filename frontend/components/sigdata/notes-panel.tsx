"use client";

import { Check, Pencil, Plus, StickyNote, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { confirmAction, toast } from "@/lib/feedback";
import { useNotesStore, type ProjectNote } from "@/lib/notes/store";

const EMPTY: ProjectNote[] = [];

const NoteCard = ({ notebookId, note }: { notebookId: string; note: ProjectNote }) => {
  const update = useNotesStore((state) => state.update);
  const remove = useNotesStore((state) => state.remove);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await update(notebookId, note.id, { title, body });
      setEditing(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-xl border border-border bg-card p-3 shadow-sm">
      {editing ? (
        <div className="space-y-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Título (opcional)"
            aria-label="Título da nota"
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={6}
            aria-label="Texto da nota"
            className="w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-xs leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <div className="flex justify-end gap-1.5">
            <Button size="xs" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
              <X className="size-3" aria-hidden />
              Cancelar
            </Button>
            <Button size="xs" onClick={() => void save()} disabled={busy || !body.trim()}>
              <Check className="size-3" aria-hidden />
              Salvar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
              {note.title || "Nota"}
            </h3>
            <button
              type="button"
              aria-label="Editar nota"
              title="Editar"
              onClick={() => setEditing(true)}
              className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Pencil className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Excluir nota"
              title="Excluir"
              onClick={() =>
                void confirmAction({ title: "Excluir esta nota?", confirmLabel: "Excluir", destructive: true }).then(
                  (ok) => {
                    if (ok) void remove(notebookId, note.id).catch((error: Error) => toast.error(error.message));
                  },
                )
              }
              className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </div>
          <p className="mt-1 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">{note.body}</p>
          <p className="mt-2 text-[10px] text-muted-foreground/80">
            {new Date(note.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          </p>
        </>
      )}
    </article>
  );
};

/** Notas do projeto: o que a pessoa fixou das respostas, mais as anotações que escrever. */
export const NotesPanel = ({ notebookId }: { notebookId: string }) => {
  const notes = useNotesStore((state) => state.notesByNotebook[notebookId]) ?? EMPTY;
  const loaded = useNotesStore((state) => state.loaded[notebookId]);
  const loadError = useNotesStore((state) => state.loadErrors[notebookId]);
  const load = useNotesStore((state) => state.load);
  const add = useNotesStore((state) => state.add);

  useEffect(() => {
    void load(notebookId);
  }, [load, notebookId]);

  const create = () =>
    void add(notebookId, { title: "", body: "Nova nota" }).catch((error: Error) => toast.error(error.message));

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
        <p className="text-sm font-medium text-foreground">Não foi possível carregar as notas</p>
        <p className="text-xs text-muted-foreground">{loadError}</p>
        <Button size="xs" variant="outline" onClick={() => void load(notebookId)}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <Button size="xs" variant="outline" className="self-start" onClick={create}>
        <Plus className="size-3.5" aria-hidden />
        Nova nota
      </Button>
      {loaded && notes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <span className="grid size-10 place-items-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
            <StickyNote className="size-5" aria-hidden />
          </span>
          <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
            Fixe uma resposta do assistente como nota (ícone de marcador abaixo da resposta) ou escreva a sua.
          </p>
        </div>
      ) : (
        notes.map((note) => <NoteCard key={note.id} notebookId={notebookId} note={note} />)
      )}
    </div>
  );
};
