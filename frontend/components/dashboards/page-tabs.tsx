"use client";

import { ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { MAX_PAGES } from "@/lib/dashboards/types";

type Props = {
  /** Visualização/compartilhado: só navega entre as páginas. */
  readOnly?: boolean;
  className?: string;
};

const tabCls = (active: boolean) =>
  `max-w-40 truncate rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
  }`;

/** Abas de páginas do dashboard (como as abas de uma planilha ou do Power BI). */
export const PageTabs = ({ readOnly = false, className = "" }: Props) => {
  const pages = useDashboardsStore((state) => {
    const doc = state.currentId ? state.dashboards[state.currentId] : undefined;
    return doc?.pages?.map((page) => ({ id: page.id, name: page.name })) ?? null;
  });
  const activeId = useDashboardsStore((state) => state.activePageId);
  const switchPage = useDashboardsStore((state) => state.switchPage);
  const addPage = useDashboardsStore((state) => state.addPage);
  const duplicatePage = useDashboardsStore((state) => state.duplicatePage);
  const deletePage = useDashboardsStore((state) => state.deletePage);
  const renamePage = useDashboardsStore((state) => state.renamePage);
  const movePage = useDashboardsStore((state) => state.movePage);

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const list = pages ?? [{ id: "single", name: "Página 1" }];
  // painel de uma página só, em leitura: não há o que navegar
  if (readOnly && list.length < 2) return null;
  const current = activeId ?? list[0].id;
  const index = list.findIndex((page) => page.id === current);

  const commit = () => {
    if (editing && draft.trim()) renamePage(editing, draft.trim());
    setEditing(null);
  };

  return (
    <div
      role="tablist"
      aria-label="Páginas do painel"
      className={`flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-border/70 bg-popover/90 p-1 shadow-sm backdrop-blur ${className}`}
    >
      {list.map((page) =>
        editing === page.id ? (
          <input
            key={page.id}
            ref={input}
            value={draft}
            maxLength={60}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
              if (event.key === "Escape") setEditing(null);
            }}
            aria-label="Nome da página"
            className="h-7 w-32 rounded-md border border-primary/60 bg-background px-2 text-[11px] outline-none"
          />
        ) : (
          <button
            key={page.id}
            type="button"
            role="tab"
            aria-selected={page.id === current}
            title={readOnly ? page.name : `${page.name} — duplo clique para renomear`}
            onClick={() => switchPage(page.id)}
            onDoubleClick={() => {
              if (readOnly || !pages) return;
              setDraft(page.name);
              setEditing(page.id);
            }}
            className={tabCls(page.id === current)}
          >
            {page.name}
          </button>
        ),
      )}

      {!readOnly ? (
        <>
          <span className="mx-0.5 h-4 w-px shrink-0 bg-border/70" />
          <button
            type="button"
            onClick={addPage}
            disabled={list.length >= MAX_PAGES}
            aria-label="Nova página"
            title="Nova página"
            className="grid size-7 shrink-0 place-items-center rounded-md text-foreground transition-colors hover:bg-muted/70 disabled:opacity-30"
          >
            <Plus className="size-3.5" aria-hidden />
          </button>
          {pages ? (
            <>
              <button
                type="button"
                onClick={() => movePage(current, -1)}
                disabled={index <= 0}
                aria-label="Mover página para a esquerda"
                title="Mover para a esquerda"
                className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground disabled:opacity-30"
              >
                <ChevronLeft className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => movePage(current, 1)}
                disabled={index >= list.length - 1}
                aria-label="Mover página para a direita"
                title="Mover para a direita"
                className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground disabled:opacity-30"
              >
                <ChevronRight className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => duplicatePage(current)}
                disabled={list.length >= MAX_PAGES}
                aria-label="Duplicar página"
                title="Duplicar página"
                className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground disabled:opacity-30"
              >
                <Copy className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => {
                  const name = list[index]?.name ?? "esta página";
                  if (window.confirm(`Excluir a página "${name}" e todos os seus elementos?`)) deletePage(current);
                }}
                aria-label="Excluir página"
                title="Excluir página"
                className="grid size-7 shrink-0 place-items-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
};
