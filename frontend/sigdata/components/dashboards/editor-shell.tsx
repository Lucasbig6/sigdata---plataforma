"use client";

import { Minus, Plus, Scan } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { DashboardCanvas } from "./canvas";
import { ElementLibrary } from "./element-library";
import { PropertiesPanel } from "./properties-panel";
import { TopBar } from "./top-bar";

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2;

const EditorSkeleton = () => (
  <div className="flex h-dvh flex-col overflow-hidden bg-background">
    <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border/60 bg-card/60 px-3">
      <div className="size-7 animate-pulse rounded-md bg-muted" />
      <div className="h-6 w-48 animate-pulse rounded-md bg-muted" />
      <div className="ml-auto h-7 w-24 animate-pulse rounded-md bg-muted" />
    </div>
    <div className="flex min-h-0 flex-1">
      <div className="hidden w-60 shrink-0 border-r border-border/60 bg-card/40 lg:block" />
      <div className="flex min-w-0 flex-1 items-center justify-center">
        <div className="h-72 w-96 animate-pulse rounded-xl bg-muted/50" />
      </div>
      <div className="hidden w-72 shrink-0 border-l border-border/60 bg-card/40 xl:block" />
    </div>
  </div>
);

const NotFound = () => (
  <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
    <p className="text-sm font-medium text-foreground">Painel não encontrado</p>
    <p className="max-w-sm text-xs text-muted-foreground">
      Este dashboard não existe mais ou ainda não foi criado nesta sessão.
    </p>
    <Link
      href="/dashboards"
      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
    >
      Voltar para dashboards
    </Link>
  </div>
);

export const EditorShell = ({ dashboardId }: { dashboardId: string }) => {
  const hydrated = useDashboardsStore((state) => state.hydrated);
  const hydrate = useDashboardsStore((state) => state.hydrate);
  const openDashboard = useDashboardsStore((state) => state.openDashboard);
  const doc = useDashboardsStore((state) =>
    state.currentId ? (state.dashboards[state.currentId] ?? null) : null,
  );
  const dirty = useDashboardsStore((state) => state.dirty);
  const savedAt = useDashboardsStore((state) => state.savedAt);
  const pastLength = useDashboardsStore((state) => state.past.length);
  const futureLength = useDashboardsStore((state) => state.future.length);
  const preview = useDashboardsStore((state) => state.preview);
  const setPreview = useDashboardsStore((state) => state.setPreview);
  const rename = useDashboardsStore((state) => state.rename);
  const undo = useDashboardsStore((state) => state.undo);
  const redo = useDashboardsStore((state) => state.redo);
  const save = useDashboardsStore((state) => state.save);
  const selectedId = useDashboardsStore((state) => state.selectedId);
  const select = useDashboardsStore((state) => state.select);
  const nudge = useDashboardsStore((state) => state.nudge);
  const removeElement = useDashboardsStore((state) => state.removeElement);

  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated) openDashboard(dashboardId);
  }, [hydrated, dashboardId, openDashboard]);

  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("preview") === "1") setPreview(true);
  }, [hydrated, setPreview]);

  const togglePreview = () => {
    const next = !preview;
    setPreview(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("preview", "1");
    else url.searchParams.delete("preview");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        Boolean(target?.isContentEditable);
      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
        return;
      }
      if (typing) return;

      if (event.key === "Escape") {
        if (preview) togglePreview();
        else select(null);
        return;
      }
      if (preview) return;

      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        removeElement(selectedId);
        select(null);
        return;
      }
      if (selectedId && event.key.startsWith("Arrow")) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        if (event.key === "ArrowUp") nudge(selectedId, 0, -step);
        if (event.key === "ArrowDown") nudge(selectedId, 0, step);
        if (event.key === "ArrowLeft") nudge(selectedId, -step, 0);
        if (event.key === "ArrowRight") nudge(selectedId, step, 0);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!hydrated) return <EditorSkeleton />;
  if (!doc || doc.id !== dashboardId) return <NotFound />;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <TopBar
        name={doc.name}
        dirty={dirty}
        savedAt={savedAt}
        canUndo={pastLength > 0}
        canRedo={futureLength > 0}
        zoom={zoom}
        preview={preview}
        onRename={rename}
        onUndo={undo}
        onRedo={redo}
        onSave={save}
        onZoom={(value) => setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)))}
        onTogglePreview={togglePreview}
      />

      <div className="flex min-h-0 flex-1">
        {!preview ? <ElementLibrary /> : null}

        <div className="relative min-w-0 flex-1 overflow-hidden">
          <DashboardCanvas zoom={zoom} preview={preview} />

          {preview ? (
            <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-border/70 bg-popover/90 px-3 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur">
              Pré-visualização · dados de demonstração
            </div>
          ) : (
            <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md border border-border/70 bg-popover/90 p-1 shadow-sm backdrop-blur">
              <button
                type="button"
                aria-label="Diminuir zoom"
                onClick={() =>
                  setZoom((value) => Math.max(ZOOM_MIN, Math.round((value - 0.1) * 10) / 10))
                }
                className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <Minus className="size-3.5" aria-hidden />
              </button>
              <span className="min-w-11 rounded px-1 text-center text-[11px] tabular-nums text-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                aria-label="Aumentar zoom"
                onClick={() =>
                  setZoom((value) => Math.min(ZOOM_MAX, Math.round((value + 0.1) * 10) / 10))
                }
                className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <Plus className="size-3.5" aria-hidden />
              </button>
              <span className="mx-0.5 h-4 w-px bg-border/70" />
              <button
                type="button"
                aria-label="Voltar o zoom a 100%"
                title="100%"
                onClick={() => setZoom(1)}
                className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <Scan className="size-3.5" aria-hidden />
              </button>
            </div>
          )}
        </div>

        {!preview ? <PropertiesPanel /> : null}
      </div>
    </div>
  );
};
