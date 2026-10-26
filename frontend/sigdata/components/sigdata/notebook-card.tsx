"use client";

import { ArrowUpRight, BookOpen, MoreVertical, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Notebook } from "@/lib/notebooks/store";
import { CoverArt } from "./cover-art";

const COVER_GRADIENTS = [
  "linear-gradient(145deg, #1e3a5f 0%, #0f766e 100%)",
  "linear-gradient(145deg, #4a1d3f 0%, #7c2d12 100%)",
  "linear-gradient(145deg, #1e1b4b 0%, #5b21b6 100%)",
  "linear-gradient(145deg, #14532d 0%, #a16207 100%)",
  "linear-gradient(145deg, #0c4a6e 0%, #9d174d 100%)",
  "linear-gradient(145deg, #27272a 0%, #3f3f46 55%, #18181b 100%)",
  "linear-gradient(145deg, #312e81 0%, #0e7490 100%)",
  "linear-gradient(145deg, #450a0a 0%, #701a75 100%)",
];

export const coverGradient = (index: number): string =>
  COVER_GRADIENTS[Math.abs(index) % COVER_GRADIENTS.length]!;

const formatDate = (timestamp: number): string =>
  new Date(timestamp).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const formatSources = (count: number): string => (count === 1 ? "1 fonte" : `${count} fontes`);

type NotebookCardProps = {
  notebook: Notebook;
  view: "grid" | "list";
  index?: number;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
};

export const NotebookCard = ({
  notebook,
  view,
  index = 0,
  onRename,
  onDelete,
}: NotebookCardProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [draft, setDraft] = useState(notebook.title);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const openRename = () => {
    setMenuOpen(false);
    setDraft(notebook.title);
    setRenameOpen(true);
  };

  const handleDelete = () => {
    setMenuOpen(false);
    if (window.confirm(`Excluir o projeto "${notebook.title}"? Esta ação não pode ser desfeita.`)) {
      onDelete(notebook.id);
    }
  };

  const submitRename = () => {
    onRename(notebook.id, draft);
    setRenameOpen(false);
  };

  const menu = (
    <div ref={menuRef} className="absolute top-2.5 right-2.5 z-10">
      <button
        type="button"
        aria-label="Opções do projeto"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setMenuOpen((open) => !open);
        }}
        className={cn(
          "grid size-7 place-items-center rounded-xl transition-colors outline-none",
          view === "grid"
            ? "bg-white/10 text-white/90 ring-1 ring-white/20 backdrop-blur-md hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/60"
            : "text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
          menuOpen && (view === "grid" ? "bg-white/25" : "bg-muted"),
        )}
      >
        <MoreVertical className="size-4" aria-hidden />
      </button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute top-9 right-0 z-20 w-40 overflow-hidden rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openRename();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs transition-colors hover:bg-muted"
          >
            <Pencil className="size-3.5" aria-hidden />
            Renomear
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleDelete();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs text-destructive transition-colors hover:bg-destructive/10"
          >
            <Trash2 className="size-3.5" aria-hidden />
            Excluir
          </button>
        </div>
      )}
    </div>
  );

  const renameDialog = (
    <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renomear projeto</DialogTitle>
        </DialogHeader>
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submitRename();
          }}
          placeholder="Título do projeto"
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setRenameOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submitRename}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (view === "list") {
    return (
      <>
        <article
          className="group sd-card relative"
          style={{ animationDelay: `${Math.min(index, 12) * 50}ms` }}
        >
          <Link
            href={`/workspace?notebook=${notebook.id}`}
            className={cn(
              "flex items-stretch gap-3.5 overflow-hidden rounded-xl border border-border/70 bg-card/60 p-2.5 pr-11 transition-colors",
              "hover:border-primary/40 hover:bg-card focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/40 outline-none",
            )}
          >
            <div
              className="relative w-24 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/10"
              style={{ backgroundImage: coverGradient(notebook.coverIndex) }}
              aria-hidden
            >
              <div className="absolute inset-0 bg-[radial-gradient(130%_90%_at_50%_-10%,rgba(255,255,255,0.2),transparent_55%)]" />
              <CoverArt index={notebook.coverIndex} />
              <BookOpen className="absolute top-1.5 left-1.5 size-3.5 text-white/90" />
            </div>
            <div className="flex min-w-0 flex-col justify-center gap-1 py-1">
              <h2 className="truncate text-sm font-medium tracking-tight text-foreground">
                {notebook.title}
              </h2>
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <span>{formatDate(notebook.updatedAt)}</span>
                <span className="size-0.5 shrink-0 rounded-full bg-muted-foreground/50" />
                <span>{formatSources(notebook.sourceCount)}</span>
              </p>
            </div>
          </Link>
          {menu}
          {renameDialog}
        </article>
      </>
    );
  }

  return (
    <>
      <article
        className="group sd-card relative"
        style={{ animationDelay: `${Math.min(index, 12) * 50}ms` }}
      >
        <Link
          href={`/workspace?notebook=${notebook.id}`}
          className={cn(
            "relative block aspect-[3/2] overflow-hidden rounded-2xl outline-none",
            "ring-1 ring-inset ring-white/10",
            "transition-all duration-200 ease-out",
            "hover:scale-[1.015] hover:shadow-lg hover:shadow-black/20",
            "focus-visible:ring-2 focus-visible:ring-ring/60",
          )}
          style={{ backgroundImage: coverGradient(notebook.coverIndex) }}
        >
          <div
            className="absolute inset-0 bg-[radial-gradient(130%_90%_at_50%_-10%,rgba(255,255,255,0.22),transparent_55%)]"
            aria-hidden
          />
          <CoverArt index={notebook.coverIndex} />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent"
            aria-hidden
          />
          <span className="absolute top-3 left-3 grid size-9 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur-md transition-colors group-hover:bg-white/20">
            <BookOpen className="size-4 text-white" aria-hidden />
          </span>
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-5 pr-12">
            <h2 className="line-clamp-2 text-2xl leading-snug font-medium tracking-tight text-white drop-shadow-sm">
              {notebook.title}
            </h2>
            <p className="flex items-center gap-1.5 text-[12px] text-white/75">
              <span>{formatDate(notebook.updatedAt)}</span>
              <span className="size-0.5 rounded-full bg-white/50" />
              <span>{formatSources(notebook.sourceCount)}</span>
            </p>
          </div>
          <span
            aria-hidden
            className="absolute right-3 bottom-3 grid size-8 translate-y-1 place-items-center rounded-full bg-white/15 text-white opacity-0 ring-1 ring-white/25 backdrop-blur-md transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100"
          >
            <ArrowUpRight className="size-4" />
          </span>
        </Link>
        {menu}
        {renameDialog}
      </article>
    </>
  );
};
