"use client";

import { PanelLeft, PanelRight, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/lib/chat/store";
import { useNotebooksStore } from "@/lib/notebooks/store";
import { useNotebookId } from "@/lib/use-notebook-id";
import { Logo } from "./logo";
import { openCommandPalette } from "./command-palette";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { WorkspaceTitle } from "./workspace-title";
import { projectHref } from "@/lib/routes";

/** Barra superior: início, nome do projeto (editável), busca, novo projeto, tema e conta. */
export const WorkspaceTopbar = ({
  onToggleSources,
  onToggleStudio,
  sourcesOpen,
  studioOpen,
  fallbackTitle,
}: {
  onToggleSources: () => void;
  onToggleStudio: () => void;
  sourcesOpen: boolean;
  studioOpen: boolean;
  fallbackTitle: string;
}) => {
  const router = useRouter();
  const createNotebook = useNotebooksStore((state) => state.createNotebook);
  const createChat = useChatStore((state) => state.createChat);
  const notebookId = useNotebookId();

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 px-3 sm:px-4">
        <Link
          href="/"
          aria-label="Ir para a página inicial"
          className="shrink-0 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <Logo className="h-[44px] w-auto" />
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Mostrar ou ocultar fontes"
          aria-pressed={sourcesOpen}
          title="Fontes"
          onClick={onToggleSources}
          className="ml-1 max-sm:size-10"
        >
          <PanelLeft className="size-4" aria-hidden />
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2 max-md:hidden">
          <Link
            href="/"
            className="hidden shrink-0 rounded text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 md:block"
          >
            Projetos
          </Link>
          <span className="hidden text-muted-foreground/60 md:block" aria-hidden>
            ›
          </span>
          <WorkspaceTitle fallback={fallbackTitle} />
        </div>
        <div className="flex-1 md:hidden" aria-hidden />

        <Button
          variant="ghost"
          size="sm"
          onClick={openCommandPalette}
          className="hidden gap-1.5 text-muted-foreground sm:inline-flex"
        >
          <Search className="size-4" aria-hidden />
          Buscar
          <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">
            Ctrl K
          </kbd>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="hidden gap-1.5 rounded-full sm:inline-flex"
          onClick={() => router.push(projectHref(createNotebook()))}
        >
          <Plus className="size-4" aria-hidden />
          Novo projeto
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="max-sm:size-10"
          aria-label="Mostrar ou ocultar o estúdio"
          aria-pressed={studioOpen}
          title="Estúdio"
          onClick={onToggleStudio}
        >
          <PanelRight className="size-4" aria-hidden />
        </Button>
        <ThemeToggle />
        <UserMenu />
      </header>

      {/* celular: o título não cabe na barra de cima; ganha uma linha própria, com atalho de nova conversa */}
      <div className="flex shrink-0 items-center gap-2 px-3 pb-2 md:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <WorkspaceTitle fallback={fallbackTitle} />
        </div>
        {notebookId ? (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 rounded-full"
            onClick={() => router.push(projectHref(notebookId, createChat(notebookId)))}
          >
            <Plus className="size-4" aria-hidden />
            Nova conversa
          </Button>
        ) : null}
      </div>
    </>
  );
};
