"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Rnd } from "react-rnd";
import {
  BarChart3,
  BookmarkPlus,
  Check,
  ChevronRight,
  Copy,
  Database,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_NOTICE, DEMO_SOURCE, MUNICIPIOS, SERIE_TEMPORAL } from "@/lib/demo-data";
import { saveAnalysis } from "@/lib/dashboards/analyses";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { findLibraryItem } from "@/lib/dashboards/presets";
import { usePanelStore, WIDGET_MIN_SIZE, type PanelWidget, type WidgetKind } from "@/lib/panel/store";
import { useNotebooksStore } from "@/lib/notebooks/store";
import { useSigdata } from "@/lib/sigdata-store";
import { cn } from "@/lib/utils";
import { BarChart, DataTable, KpiGrid, LineChart } from "./visualizations";

type TabId = "todos" | "grafico" | "tabela" | "indicadores";

const TABS: { id: TabId; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "grafico", label: "Gráficos" },
  { id: "tabela", label: "Tabela" },
  { id: "indicadores", label: "Indicadores" },
];

const EMPTY_WIDGETS: PanelWidget[] = [];

const matchesTab = (kind: WidgetKind, tab: TabId): boolean => {
  switch (tab) {
    case "todos":
      return true;
    case "grafico":
      return kind === "linha" || kind === "barras";
    case "tabela":
      return kind === "tabela";
    case "indicadores":
      return kind === "kpi";
  }
};

const WidgetBody = ({ widget }: { widget: PanelWidget }) => {
  if (widget.kind === "linha") {
    return <LineChart data={widget.series ?? SERIE_TEMPORAL} />;
  }
  if (widget.kind === "barras") {
    return <BarChart data={widget.series ?? SERIE_TEMPORAL} />;
  }
  if (widget.kind === "kpi") {
    return <KpiGrid items={widget.kpis ?? []} />;
  }
  return <DataTable rows={widget.rows ?? MUNICIPIOS} />;
};

const WidgetCard = ({
  widget,
  onRemove,
  onFocus,
}: {
  widget: PanelWidget;
  onRemove: () => void;
  onFocus: () => void;
}) => (
  <article
    onPointerDown={onFocus}
    className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm"
  >
    <header className="widget-handle flex cursor-grab items-center gap-2 border-b border-border/70 bg-muted/30 px-3 py-1.5 active:cursor-grabbing">
      <h3 className="min-w-0 flex-1 truncate text-xs font-medium text-foreground" title={widget.title}>
        {widget.title}
      </h3>
      <button
        type="button"
        aria-label={`Remover ${widget.title}`}
        title="Remover"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </header>
    <div className="min-h-0 flex-1 overflow-auto p-2">
      <WidgetBody widget={widget} />
    </div>
  </article>
);

const EmptyState = () => (
  <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
    <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
      <Database className="size-5" aria-hidden />
    </span>
    <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
      Peça um gráfico, indicador ou tabela ao assistente e use &quot;Adicionar ao painel&quot; para
      fixar a visualização aqui.
    </p>
    <p className="text-xs text-muted-foreground/70">Os widgets podem ser arrastados e redimensionados.</p>
  </div>
);

export const WorkPanel = ({ className }: { className?: string }) => {
  const notebookId = useSearchParams().get("notebook");
  const {
    panelView,
    panelCollapsed,
    panelMobileOpen,
    setPanelView,
    togglePanelCollapsed,
    setPanelMobileOpen,
    savePreferences,
  } = useSigdata();

  const widgetsByNotebook = usePanelStore((state) => state.widgetsByNotebook);
  const widgets =
    (notebookId ? widgetsByNotebook[notebookId] : undefined) ?? EMPTY_WIDGETS;
  const hydratePanel = usePanelStore((state) => state.hydrate);
  const updateGeometry = usePanelStore((state) => state.updateGeometry);
  const removeWidget = usePanelStore((state) => state.removeWidget);
  const bringToFront = usePanelStore((state) => state.bringToFront);
  const notebooks = useNotebooksStore((state) => state.notebooks);
  const openDashboard = useDashboardsStore((state) => state.openDashboard);
  const createDashboard = useDashboardsStore((state) => state.createDashboard);
  const beginTransaction = useDashboardsStore((state) => state.beginTransaction);
  const addElement = useDashboardsStore((state) => state.addElement);
  const updateProps = useDashboardsStore((state) => state.updateProps);
  const endTransaction = useDashboardsStore((state) => state.endTransaction);
  const saveDashboard = useDashboardsStore((state) => state.save);

  const [note, setNote] = useState<string | null>(null);
  const panelVisible = !panelCollapsed || panelMobileOpen;

  useEffect(() => {
    hydratePanel();
  }, [hydratePanel]);

  useEffect(() => {
    if (!note) return;
    const timeout = setTimeout(() => setNote(null), 4200);
    return () => clearTimeout(timeout);
  }, [note]);

  const filtered = useMemo(
    () => widgets.filter((widget) => matchesTab(widget.kind, panelView)),
    [widgets, panelView],
  );

  const maxZ = widgets.reduce((max, widget) => Math.max(max, widget.z), 0);
  const containerHeight = Math.max(
    320,
    ...widgets.map((widget) => widget.y + widget.h + 24),
  );

  const handleDragStop = useCallback(
    (id: string, x: number, y: number) => {
      if (!notebookId) return;
      updateGeometry(notebookId, id, { x, y });
    },
    [notebookId, updateGeometry],
  );

  const handleResizeStop = useCallback(
    (id: string, w: number, h: number, x: number, y: number) => {
      if (!notebookId) return;
      updateGeometry(notebookId, id, { w, h, x, y });
    },
    [notebookId, updateGeometry],
  );

  const handleRemove = useCallback(
    (id: string) => {
      if (!notebookId) return;
      removeWidget(notebookId, id);
    },
    [notebookId, removeWidget],
  );

  const handleFocus = useCallback(
    (id: string) => {
      if (!notebookId) return;
      bringToFront(notebookId, id);
    },
    [notebookId, bringToFront],
  );

  const handleSaveAsDashboard = () => {
    if (!notebookId || widgets.length === 0) {
      setNote("Adicione visualizações ao painel antes de salvar.");
      return;
    }
    const notebook = notebooks.find((entry) => entry.id === notebookId);
    const title = notebook?.title?.trim() || "Dashboard do projeto";

    if (widgets.some((widget) => widget.series && widget.series.length > 0)) {
      const firstChart = widgets.find((widget) => widget.series && widget.series.length > 0);
      saveAnalysis(
        {
          kpis: widgets.find((widget) => widget.kpis)?.kpis ?? [],
          serie: firstChart?.series ?? SERIE_TEMPORAL,
          municipios: widgets.find((widget) => widget.rows)?.rows ?? MUNICIPIOS,
          resumos: [],
        },
        `${title} · análise`,
      );
    }

    const id = createDashboard();
    openDashboard(id);
    beginTransaction("panel-import");

    const keyByKind: Record<WidgetKind, string> = {
      linha: "line",
      barras: "bar",
      kpi: "kpi",
      tabela: "table",
    };

    for (const widget of widgets) {
      const item = findLibraryItem(keyByKind[widget.kind]);
      if (!item) continue;
      const elementId = addElement(item, { x: widget.x, y: widget.y });
      if (!elementId) continue;
      const patch: Record<string, unknown> = { title: widget.title, showTitle: true };
      if (widget.kind === "linha") patch.chartType = "line";
      if (widget.kind === "barras") patch.chartType = "bar";
      if (widget.kind === "kpi" && widget.kpis?.[0]) {
        patch.title = widget.kpis[0].label;
        patch.value = widget.kpis[0].value;
      }
      updateProps(elementId, patch);
    }

    endTransaction();
    saveDashboard();
    savePreferences();
    setNote(`Dashboard "${title}" salvo — abra em Dashboards.`);
  };

  const handleShare = async () => {
    if (!notebookId) {
      setNote("Abra um projeto para compartilhar.");
      return;
    }
    const url = `${window.location.origin}/workspace?notebook=${notebookId}`;
    try {
      await navigator.clipboard.writeText(url);
      setNote("Link do projeto copiado.");
    } catch {
      setNote(url);
    }
  };

  return (
    <section
      data-slot="sigdata-work-panel"
      className={cn(
        "flex h-full w-full min-w-0 flex-1 flex-col bg-panel text-foreground",
        "border-s border-border",
        className,
      )}
      aria-label="Área de trabalho"
    >
      <header className="flex flex-col gap-2 border-b border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-1xl font-medium text-foreground pb-3">
              {notebooks.find((entry) => entry.id === notebookId)?.title ?? "Painel analítico"}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-primary">
                <BarChart3 className="size-3" aria-hidden />
                {DEMO_NOTICE}
              </span>
              {widgets.length > 0 ? (
                <span className="text-[11px] text-muted-foreground">
                  {widgets.length} widget(s)
                </span>
              ) : null}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={togglePanelCollapsed}
            aria-label={panelCollapsed ? "Expandir visualizações" : "Recolher visualizações"}
            title={panelCollapsed ? "Expandir visualizações" : "Recolher visualizações"}
          >
            {panelCollapsed ? (
              <Plus className="size-4" aria-hidden />
            ) : (
              <Minus className="size-4" aria-hidden />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setPanelMobileOpen(false)}
            aria-label="Fechar visualizações"
            title="Fechar visualizações"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="xs"
            variant="outline"
            onClick={handleSaveAsDashboard}
            disabled={widgets.length === 0}
          >
            <BookmarkPlus className="size-3.5" aria-hidden />
            Salvar como dashboard
          </Button>
          <Button size="xs" variant="outline" onClick={handleShare}>
            <Copy className="size-3.5" aria-hidden />
            Compartilhar
          </Button>
          {note ? <span className="text-[11px] text-muted-foreground">{note}</span> : null}
        </div>

        <div
          role="tablist"
          aria-label="Filtrar widgets do painel"
          className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={panelView === tab.id}
              onClick={() => {
                setPanelView(tab.id);
                savePreferences();
              }}
              className={cn(
                "flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring/50",
                panelView === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-auto">
        {!panelVisible ? null : widgets.length === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhum widget nesta categoria.</p>
            <Button size="xs" variant="outline" onClick={() => setPanelView("todos")}>
              Ver todos
            </Button>
          </div>
        ) : (
          <div className="relative w-full" style={{ height: containerHeight, minHeight: "100%" }}>
            {filtered.map((widget) => {
              const min = WIDGET_MIN_SIZE[widget.kind];
              return (
                <Rnd
                  key={widget.id}
                  default={{ x: widget.x, y: widget.y, width: widget.w, height: widget.h }}
                  position={{ x: widget.x, y: widget.y }}
                  size={{ width: widget.w, height: widget.h }}
                  bounds="parent"
                  minWidth={min.w}
                  minHeight={min.h}
                  dragHandleClassName="widget-handle"
                  cancel=".no-drag"
                  disableDragging={!panelVisible}
                  onDragStart={() => handleFocus(widget.id)}
                  onDragStop={(_e, d) => handleDragStop(widget.id, d.x, d.y)}
                  onResizeStart={() => handleFocus(widget.id)}
                  onResizeStop={(_e, _direction, ref, _delta, position) =>
                    handleResizeStop(
                      widget.id,
                      ref.offsetWidth,
                      ref.offsetHeight,
                      position.x,
                      position.y,
                    )
                  }
                  style={{ zIndex: 1 + widget.z }}
                >
                  <WidgetCard
                    widget={widget}
                    onRemove={() => handleRemove(widget.id)}
                    onFocus={() => handleFocus(widget.id)}
                  />
                </Rnd>
              );
            })}
            <span className="sr-only" aria-live="polite">
              z-index máximo {maxZ}
            </span>
          </div>
        )}
      </div>

      <p className="border-t border-border/60 px-4 py-2 text-[10px] text-muted-foreground/80">
        {DEMO_SOURCE}
        <span className="ms-1.5 inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 align-middle">
          <Check className="size-3 text-primary" aria-hidden />
          demonstração
        </span>
      </p>
    </section>
  );
};
