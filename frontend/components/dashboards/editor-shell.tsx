"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardDataProvider } from "@/lib/dashboards/live-data";
import { useDatasetsStore } from "@/lib/datasets/store";
import { useAnalysesStore } from "@/lib/dashboards/analyses";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { CANVAS } from "@/lib/dashboards/types";
import { TEMPLATES, applyTemplate } from "@/lib/dashboards/templates";
import { useZoomFit } from "@/lib/dashboards/use-zoom-fit";
import { DashboardCanvas } from "./canvas";
import { ElementLibrary } from "./element-library";
import { ArrangeToolbar } from "./arrange-toolbar";
import { toMobileLayout } from "@/lib/dashboards/mobile-layout";
import { globalFiltersFromOtherPages } from "@/lib/dashboards/pages";
import { ClearFilters } from "./clear-filters";
import { ExportMenu } from "./export-menu";
import { PageSettings } from "./page-settings";
import { PageTabs } from "./page-tabs";
import { PropertiesPanel } from "./properties-panel";
import { TopBar } from "./top-bar";
import { ViewControls } from "./view-controls";

const PRIVATE_MODE = { kind: "private" } as const;

/** Espaço em volta da página no editor (padding do viewport + moldura). */
const EDIT_PADDING = 120;

/** Menu flutuante com o tamanho da página, cor de fundo e grade. */
const PageMenu = ({ width, height }: { width: number; height: number }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="absolute bottom-3 left-3 z-20">
      {open ? (
        <div
          role="dialog"
          aria-label="Configurações da página"
          className="absolute bottom-10 left-0 max-h-[70vh] w-72 overflow-y-auto rounded-lg border border-border/70 bg-popover p-3 shadow-lg"
        >
          <p className="mb-2 text-xs font-semibold text-foreground">Página</p>
          <PageSettings />
          <div className="mt-3 border-t border-border/60 pt-2.5">
            <p className="mb-1.5 text-[11px] text-muted-foreground">Adicionar modelo de página</p>
            <div className="flex flex-col gap-1">
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  title={template.description}
                  onClick={() => {
                    applyTemplate(template.id);
                    setOpen(false);
                  }}
                  className="rounded-md border border-border/70 px-2 py-1.5 text-left text-[11px] text-foreground transition-colors hover:bg-muted/60"
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 rounded-md border border-border/70 bg-popover/90 px-2 py-1.5 text-[11px] font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted/60"
      >
        <FileText className="size-3.5 text-primary" aria-hidden />
        Página · <span className="tabular-nums">{width} × {height}</span>
      </button>
    </div>
  );
};

const EditorSkeleton = () => (
  <div className="flex h-dvh flex-col overflow-hidden bg-background">
    <div className="flex h-20 shrink-0 items-center gap-2 border-b border-border/60 bg-card/60 px-15 backdrop-blur sm:gap-7">
      <div className="size-10 animate-pulse rounded-md bg-muted" />
      <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
      <div className="ml-auto h-9 w-24 animate-pulse rounded-md bg-muted" />
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

const NotFound = ({ message }: { message?: string }) => (
  <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
    <p className="text-sm font-medium text-foreground">Painel não encontrado</p>
    <p className="max-w-sm text-xs text-muted-foreground">
      {message ?? "Este dashboard não existe ou não pertence à sua conta."}
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
  const dashboardsHydrated = useDashboardsStore((state) => state.hydrated);
  // os gráficos resolvem as análises de forma síncrona: espera as duas coleções
  const analysesHydrated = useAnalysesStore((state) => state.hydrated);
  const hydrated = dashboardsHydrated && analysesHydrated;
  const hydrate = useDashboardsStore((state) => state.hydrate);
  const openDashboard = useDashboardsStore((state) => state.openDashboard);
  const doc = useDashboardsStore((state) =>
    state.currentId ? (state.dashboards[state.currentId] ?? null) : null,
  );
  const dirty = useDashboardsStore((state) => state.dirty);
  const savedAt = useDashboardsStore((state) => state.savedAt);
  const saving = useDashboardsStore((state) => state.saving);
  const saveError = useDashboardsStore((state) => state.saveError);
  const loadError = useDashboardsStore((state) => state.loadError);
  const pastLength = useDashboardsStore((state) => state.past.length);
  const futureLength = useDashboardsStore((state) => state.future.length);
  const preview = useDashboardsStore((state) => state.preview);
  const setPreview = useDashboardsStore((state) => state.setPreview);
  const rename = useDashboardsStore((state) => state.rename);
  const undo = useDashboardsStore((state) => state.undo);
  const redo = useDashboardsStore((state) => state.redo);
  const save = useDashboardsStore((state) => state.save);
  const selectedIds = useDashboardsStore((state) => state.selectedIds);
  const select = useDashboardsStore((state) => state.select);
  const selectAll = useDashboardsStore((state) => state.selectAll);
  const moveSelected = useDashboardsStore((state) => state.moveSelected);
  const removeSelected = useDashboardsStore((state) => state.removeSelected);
  const duplicateSelected = useDashboardsStore((state) => state.duplicateSelected);
  const copySelected = useDashboardsStore((state) => state.copySelected);
  const cutSelected = useDashboardsStore((state) => state.cutSelected);
  const paste = useDashboardsStore((state) => state.paste);
  const groupSelected = useDashboardsStore((state) => state.groupSelected);
  const ungroupSelected = useDashboardsStore((state) => state.ungroupSelected);
  const autosave = useDashboardsStore((state) => state.autosave);
  const activePageId = useDashboardsStore((state) => state.activePageId);
  const discardChanges = useDashboardsStore((state) => state.discardChanges);
  const hydrateDatasets = useDatasetsStore((state) => state.hydrate);

  // layout para celular: só na visualização
  const [mobile, setMobile] = useState(false);
  const mobileCanvas = useMemo(() => (doc && mobile ? toMobileLayout(doc).canvas : null), [doc, mobile]);
  const { stageRef, stage, zoom, mode, setMode, setZoom } = useZoomFit({
    canvas: mobileCanvas ?? doc?.canvas ?? CANVAS,
    padding: preview ? 0 : EDIT_PADDING,
    maxZoom: preview ? 4 : 2,
  });

  useEffect(() => {
    hydrate();
    hydrateDatasets();
  }, [hydrate, hydrateDatasets]);

  // filtros globais de outras páginas continuam valendo nesta
  const providerElements = useMemo(
    () => (doc ? [...doc.elements, ...globalFiltersFromOtherPages(doc, activePageId)] : []),
    [doc, activePageId],
  );

  // salvamento automático: 2,5 s depois da última alteração
  useEffect(() => {
    if (!autosave || !dirty || saving) return;
    const timer = setTimeout(() => void save(), 2500);
    return () => clearTimeout(timer);
  }, [autosave, dirty, saving, save, doc]);

  // aviso do navegador ao sair com alterações não salvas
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

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
    setMobile(false);
    setMode("page");
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
        void save();
        return;
      }
      if (typing) return;

      if (!preview && mod) {
        const key = event.key.toLowerCase();
        if (key === "a") {
          event.preventDefault();
          selectAll();
          return;
        }
        if (key === "d" && selectedIds.length > 0) {
          event.preventDefault();
          duplicateSelected();
          return;
        }
        if (key === "c" && selectedIds.length > 0) {
          event.preventDefault();
          copySelected();
          return;
        }
        if (key === "x" && selectedIds.length > 0) {
          event.preventDefault();
          cutSelected();
          return;
        }
        if (key === "v") {
          event.preventDefault();
          paste();
          return;
        }
        if (key === "g") {
          event.preventDefault();
          if (event.shiftKey) ungroupSelected();
          else groupSelected();
          return;
        }
      }

      if (event.key === "Escape") {
        if (preview) togglePreview();
        else select(null);
        return;
      }
      if (preview) return;

      if ((event.key === "Delete" || event.key === "Backspace") && selectedIds.length > 0) {
        event.preventDefault();
        removeSelected();
        return;
      }
      if (selectedIds.length > 0 && event.key.startsWith("Arrow")) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        if (event.key === "ArrowUp") moveSelected(0, -step);
        if (event.key === "ArrowDown") moveSelected(0, step);
        if (event.key === "ArrowLeft") moveSelected(-step, 0);
        if (event.key === "ArrowRight") moveSelected(step, 0);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!hydrated) return <EditorSkeleton />;
  if (loadError) return <NotFound message={loadError} />;
  if (!doc || doc.id !== dashboardId) return <NotFound />;

  return (
    <DashboardDataProvider mode={PRIVATE_MODE} elements={providerElements} interactive={preview}>
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <TopBar
        dashboardId={doc.id}
        name={doc.name}
        saving={saving}
        saveError={saveError}
        dirty={dirty}
        savedAt={savedAt}
        canUndo={pastLength > 0}
        canRedo={futureLength > 0}
        preview={preview}
        onRename={rename}
        onUndo={undo}
        onRedo={redo}
        onSave={() => void save()}
        onDiscard={() => {
          if (window.confirm("Descartar as alterações e voltar à última versão salva?")) discardChanges();
        }}
        onTogglePreview={togglePreview}
      />

      <div className="flex min-h-0 flex-1">
        {!preview ? <ElementLibrary /> : null}

        <div ref={stageRef} className="relative min-w-0 flex-1 overflow-hidden">
          <DashboardCanvas zoom={zoom} preview={preview} fill={preview} mobile={preview && mobile} />

          {!preview ? (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3">
              <div className="pointer-events-auto max-w-full overflow-x-auto">
                <ArrangeToolbar />
              </div>
            </div>
          ) : null}

          {!preview ? <PageMenu width={doc.canvas.width} height={doc.canvas.height} /> : null}

          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-40">
            <PageTabs readOnly={preview} className="pointer-events-auto" />
          </div>

          <ViewControls
            className="absolute bottom-3 right-3"
            zoom={zoom}
            mode={mode}
            onMode={setMode}
            onZoom={setZoom}
            mobile={mobile}
            onMobile={
              preview
                ? (next) => {
                    setMobile(next);
                    setMode(next ? "width" : "page");
                  }
                : undefined
            }
            fullscreenTarget={preview ? () => stage : undefined}
          />

          {preview ? (
            <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
              <ClearFilters />
            </div>
          ) : null}
          {preview ? (
            <div className="absolute right-3 top-12 z-20">
              <ExportMenu mobileSize={mobileCanvas ?? undefined} />
            </div>
          ) : null}

          {preview ? (
            <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-border/70 bg-popover/90 px-3 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur">
              Pré-visualização
            </div>
          ) : null}
        </div>

        {!preview ? <PropertiesPanel /> : null}
      </div>
    </div>
    </DashboardDataProvider>
  );
};
