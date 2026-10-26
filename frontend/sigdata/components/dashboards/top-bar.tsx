"use client";

import { ArrowLeft, Eye, EyeOff, Minus, Plus, Redo2, Save, Undo2 } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "@/components/sigdata/logo";
import { ThemeToggle } from "@/components/sigdata/theme-toggle";

type Props = {
  name: string;
  dirty: boolean;
  savedAt: number | null;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  preview: boolean;
  onRename: (name: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onZoom: (zoom: number) => void;
  onTogglePreview: () => void;
};

const iconBtn =
  "grid size-7 place-items-center rounded-md border border-border/70 bg-background text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-40";

export const TopBar = ({
  name,
  dirty,
  savedAt,
  canUndo,
  canRedo,
  zoom,
  preview,
  onRename,
  onUndo,
  onRedo,
  onSave,
  onZoom,
  onTogglePreview,
}: Props) => {
  const status = dirty ? (
    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300">
      Alterações não salvas
    </span>
  ) : savedAt ? (
    <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
      Salvo às{" "}
      {new Date(savedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })}
    </span>
  ) : (
    <span className="rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
      Salvo
    </span>
  );

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/60 bg-card/60 px-3 backdrop-blur">
      <Link
        href="/dashboards"
        aria-label="Voltar para a lista de dashboards"
        className={`grid size-7 shrink-0 place-items-center rounded-md border border-border/70 text-foreground transition-colors hover:bg-muted/60`}
      >
        <ArrowLeft className="size-4" aria-hidden />
      </Link>

      <LogoMark className="size-6 shrink-0" />

      <input
        value={name}
        onChange={(event) => onRename(event.target.value)}
        placeholder="Nome do painel"
        aria-label="Nome do painel"
        className="w-44 min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-foreground transition-colors hover:border-border/70 focus:border-primary/60 focus:outline-none sm:w-60"
      />

      <span className="hidden sm:inline">{status}</span>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          className={iconBtn}
          disabled={!canUndo}
          onClick={onUndo}
          aria-label="Desfazer (Ctrl+Z)"
          title="Desfazer (Ctrl+Z)"
        >
          <Undo2 className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          className={iconBtn}
          disabled={!canRedo}
          onClick={onRedo}
          aria-label="Refazer (Ctrl+Shift+Z)"
          title="Refazer (Ctrl+Shift+Z)"
        >
          <Redo2 className="size-3.5" aria-hidden />
        </button>

        <span className="mx-1 hidden h-5 w-px bg-border/70 sm:block" />

        <div className="hidden items-center gap-1 rounded-md border border-border/70 bg-background px-1 py-0.5 sm:flex">
          <button
            type="button"
            className="grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => onZoom(Math.max(0.4, Math.round((zoom - 0.1) * 10) / 10))}
            aria-label="Diminuir zoom"
          >
            <Minus className="size-3" aria-hidden />
          </button>
          <span className="w-10 text-center text-[11px] tabular-nums text-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            className="grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => onZoom(Math.min(2, Math.round((zoom + 0.1) * 10) / 10))}
            aria-label="Aumentar zoom"
          >
            <Plus className="size-3" aria-hidden />
          </button>
        </div>

        <button
          type="button"
          onClick={onTogglePreview}
          className="flex h-7 items-center gap-1.5 rounded-md border border-border/70 bg-background px-2.5 text-xs text-foreground transition-colors hover:bg-muted/60"
        >
          {preview ? (
            <EyeOff className="size-3.5" aria-hidden />
          ) : (
            <Eye className="size-3.5" aria-hidden />
          )}
          <span className="hidden sm:inline">
            {preview ? "Sair da pré-visualização" : "Pré-visualizar"}
          </span>
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={!dirty}
          className="flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save className="size-3.5" aria-hidden />
          Salvar
        </button>

        <ThemeToggle />
      </div>
    </header>
  );
};
