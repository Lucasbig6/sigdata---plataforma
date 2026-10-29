"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  active: boolean;
  onOpen: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
};

/**
 * Item da lista de conversas, no padrão do ChatGPT: o menu "…" aparece ao passar o
 * mouse (sempre no item ativo ou com o menu aberto) e oferece Renomear — editando o
 * título ali mesmo — e Excluir, que pede confirmação.
 */
export const ChatListItem = ({ title, active, onOpen, onRename, onDelete }: Props) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // evita salvar duas vezes (Enter seguido do blur) ou salvar após Esc
  const finished = useRef(false);

  useEffect(() => {
    if (!editing) return;
    finished.current = false;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const startRename = () => {
    setDraft(title);
    setEditing(true);
  };

  const commit = () => {
    if (finished.current) return;
    finished.current = true;
    setEditing(false);
    const next = draft.trim();
    if (next && next !== title) onRename(next);
  };

  const cancel = () => {
    finished.current = true;
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        maxLength={120}
        aria-label="Novo nome da conversa"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") cancel();
        }}
        className="h-8 w-full rounded-lg border border-ring bg-background px-2 text-sm text-foreground outline-none ring-2 ring-ring/30"
      />
    );
  }

  return (
    <div
      className={cn(
        "group/chat relative flex items-center rounded-lg transition-colors",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        menuOpen && "bg-muted/50 text-foreground",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        onDoubleClick={startRename}
        title={title}
        className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-start text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {title}
      </button>

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          aria-label={`Opções da conversa ${title}`}
          className={cn(
            "me-1 grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-opacity",
            "hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50",
            active || menuOpen ? "opacity-100" : "opacity-0 group-hover/chat:opacity-100",
          )}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" className="w-44">
          <DropdownMenuItem onClick={startRename}>
            <Pencil className="size-3.5 shrink-0" aria-hidden />
            Renomear
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setConfirmOpen(true)}
            className="text-destructive data-[highlighted]:text-destructive"
          >
            <Trash2 className="size-3.5 shrink-0" aria-hidden />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir conversa?</DialogTitle>
            <DialogDescription>
              Isso vai excluir &ldquo;{title}&rdquo; com as mensagens e as visualizações salvas nela.
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false);
                onDelete();
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
