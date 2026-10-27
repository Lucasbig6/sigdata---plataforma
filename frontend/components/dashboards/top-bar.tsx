"use client";

import { ArrowLeft, Eye, EyeOff, Loader2, Redo2, RotateCcw, Save, Undo2, Zap } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "@/components/sigdata/logo";
import { ThemeToggle } from "@/components/sigdata/theme-toggle";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { ShareDialog } from "./share-dialog";
import { VersionHistory } from "./version-history";

type Props = {
  dashboardId: string;
  name: string;
  saving: boolean;
  saveError: string | null;
  dirty: boolean;
  savedAt: number | null;
  canUndo: boolean;
  canRedo: boolean;
  preview: boolean;
  onRename: (name: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onDiscard: () => void;
  onTogglePreview: () => void;
};

const iconBtn =
  "grid size-9 place-items-center rounded-md text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-35";

const SaveStatus = ({
  saving,
  saveError,
  dirty,
  savedAt,
}: Pick<Props, "saving" | "saveError" | "dirty" | "savedAt">) => {
  if (saving)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin" aria-hidden />
        Salvando…
      </span>
    );
  if (saveError)
    return (
      <span title={saveError} className="text-[11px] font-medium text-destructive">
        Erro ao salvar — tente de novo
      </span>
    );
  if (dirty)
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-300">
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
        Alterações não salvas
      </span>
    );
  return (
    <span className="text-[11px] text-muted-foreground">
      {savedAt
        ? `Salvo às ${new Date(savedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
        : "Tudo salvo"}
    </span>
  );
};

/** Liga/desliga o salvamento automático (2,5 s após a última alteração). */
const AutosaveToggle = () => {
  const autosave = useDashboardsStore((state) => state.autosave);
  const setAutosave = useDashboardsStore((state) => state.setAutosave);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={autosave}
      onClick={() => setAutosave(!autosave)}
      title={autosave ? "Salvamento automático ligado" : "Ligar salvamento automático"}
      className={`flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors ${
        autosave
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border/70 bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      <Zap className="size-3.5" aria-hidden />
      <span className="hidden lg:inline">Auto</span>
    </button>
  );
};

export const TopBar = ({
  dashboardId,
  name,
  saving,
  saveError,
  dirty,
  savedAt,
  canUndo,
  canRedo,
  preview,
  onRename,
  onUndo,
  onRedo,
  onSave,
  onDiscard,
  onTogglePreview,
}: Props) => (
  <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border/60 bg-card/70 px-4 backdrop-blur sm:gap-4 sm:px-6">
    <Link
      href="/dashboards"
      aria-label="Voltar para a lista de dashboards"
      className="grid size-9 shrink-0 place-items-center rounded-md border border-border/70 text-foreground transition-colors hover:bg-muted/60"
    >
      <ArrowLeft className="size-4" aria-hidden />
    </Link>

    <LogoMark className="hidden h-9 w-auto shrink-0 md:block" />
    <span className="hidden h-8 w-px bg-border/70 md:block" />

    <div className="flex min-w-0 flex-col">
      <input
        value={name}
        onChange={(event) => onRename(event.target.value)}
        placeholder="Nome do painel"
        aria-label="Nome do painel"
        disabled={preview}
        className="w-48 min-w-0 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-semibold text-foreground transition-colors hover:border-border/70 focus:border-primary/60 focus:outline-none disabled:hover:border-transparent sm:w-72"
      />
      <span className="px-1.5">
        <SaveStatus saving={saving} saveError={saveError} dirty={dirty} savedAt={savedAt} />
      </span>
    </div>

    <div className="ml-auto flex items-center gap-1.5">
      {!preview ? (
        <div className="hidden items-center sm:flex">
          <button
            type="button"
            className={iconBtn}
            disabled={!canUndo}
            onClick={onUndo}
            aria-label="Desfazer (Ctrl+Z)"
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className={iconBtn}
            disabled={!canRedo}
            onClick={onRedo}
            aria-label="Refazer (Ctrl+Shift+Z)"
            title="Refazer (Ctrl+Shift+Z)"
          >
            <Redo2 className="size-4" aria-hidden />
          </button>
          <span className="mx-1.5 h-5 w-px bg-border/70" />
        </div>
      ) : null}

      <button
        type="button"
        onClick={onTogglePreview}
        className="flex h-9 items-center gap-1.5 rounded-md border border-border/70 bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted/60"
      >
        {preview ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        <span className="hidden sm:inline">{preview ? "Editar" : "Visualizar"}</span>
      </button>

      {!preview ? <AutosaveToggle /> : null}
      {!preview ? <VersionHistory dashboardId={dashboardId} dirty={dirty} /> : null}

      <ShareDialog dashboardId={dashboardId} dirty={dirty} />

      {dirty && !saving ? (
        <button
          type="button"
          onClick={onDiscard}
          title="Voltar à última versão salva"
          className="flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <RotateCcw className="size-4" aria-hidden />
          <span className="hidden lg:inline">Descartar</span>
        </button>
      ) : null}

      <button
        type="button"
        onClick={onSave}
        disabled={(!dirty && !saveError) || saving}
        className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
        Salvar
      </button>

      <ThemeToggle />
    </div>
  </header>
);
