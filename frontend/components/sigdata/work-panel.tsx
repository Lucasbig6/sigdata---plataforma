"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Database,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DATASET_KIND_LABELS, useDatasetsStore } from "@/lib/datasets/store";
import { draftFromWidget, liveFromResult } from "@/lib/dashboards/from-workspace";
import { findLibraryItem } from "@/lib/dashboards/presets";
import { useDashboardsStore } from "@/lib/dashboards/store";
import type { AnalyticResult, ResultColumn } from "@/lib/domain/sources";
import { editWidget } from "@/lib/panel/edit";
import {
  usePanelStore,
  WIDGET_KIND_LABELS,
  type PanelWidget,
  type WidgetKind,
} from "@/lib/panel/store";
import { useNotebooksStore } from "@/lib/notebooks/store";
import { fetchResult, widgetDataFromResult } from "@/lib/results/client";
import { useSigdata } from "@/lib/sigdata-store";
import { WIDGET_KINDS, isChartKind } from "@shared/panel";
import { cn } from "@/lib/utils";
import { useRole } from "@/lib/auth-client";
import { canManageData } from "@shared/roles";
import { NotesPanel } from "./notes-panel";
import { ProjectDashboardsPanel, useProjectDashboardIds } from "./project-dashboards-panel";
import { StudioTools } from "./studio-tools";
import { WidgetView } from "./widget-view";
import { useNotesStore } from "@/lib/notes/store";
import { toast } from "@/lib/feedback";
import { useNotebookId } from "@/lib/use-notebook-id";

type TabId = "todos" | "grafico" | "tabela" | "indicadores";

const TABS: { id: TabId; label: string }[] = [
  { id: "todos", label: "Todas" },
  { id: "grafico", label: "Gráficos" },
  { id: "tabela", label: "Tabelas" },
  { id: "indicadores", label: "Indicadores" },
];

const EMPTY_WIDGETS: PanelWidget[] = [];


const matchesTab = (kind: WidgetKind, tab: TabId): boolean => {
  switch (tab) {
    case "todos":
      return true;
    case "grafico":
      return isChartKind(kind);
    case "tabela":
      return kind === "tabela";
    case "indicadores":
      return kind === "kpi";
  }
};

const fieldCls =
  "w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/** Edição de uma visualização salva: título, tipo e colunas (o agente faz o mesmo por ferramenta). */
const WidgetEditor = ({
  notebookId,
  widget,
  onClose,
}: {
  notebookId: string;
  widget: PanelWidget;
  onClose: () => void;
}) => {
  const [title, setTitle] = useState(widget.title);
  const [kind, setKind] = useState<WidgetKind>(widget.kind);
  const [columns, setColumns] = useState<ResultColumn[] | null>(null);
  const [x, setX] = useState(widget.xCol ?? "");
  const [y, setY] = useState(widget.yCol ?? "");
  const [splitBy, setSplitBy] = useState(widget.splitBy ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!widget.resultId) return;
    let cancelled = false;
    fetchResult(widget.resultId)
      .then((result) => !cancelled && setColumns(result.columns))
      .catch(() => !cancelled && setColumns([]));
    return () => {
      cancelled = true;
    };
  }, [widget.resultId]);

  const isChart = isChartKind(kind);
  const canRebind = Boolean(widget.resultId);

  const apply = async () => {
    setBusy(true);
    setError(null);
    const splitChanged = (splitBy || undefined) !== widget.splitBy;
    const columnsChanged =
      (x || undefined) !== widget.xCol || (y || undefined) !== widget.yCol || splitChanged;
    const outcome = await editWidget(notebookId, widget.id, {
      titulo: title !== widget.title ? title : undefined,
      kind: kind !== widget.kind ? kind : undefined,
      x: columnsChanged && x ? x : undefined,
      y: columnsChanged && y ? y : undefined,
      splitBy: splitChanged ? splitBy : undefined,
    });
    setBusy(false);
    if (outcome.ok) onClose();
    else setError(outcome.error);
  };

  return (
    <div className="space-y-2.5 border-b border-border/70 bg-muted/20 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-muted-foreground">Título</span>
        <input className={fieldCls} value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-muted-foreground">Tipo</span>
        <select className={fieldCls} value={kind} onChange={(event) => setKind(event.target.value as WidgetKind)}>
          {WIDGET_KINDS.map((option) => (
            <option
              key={option}
              value={option}
              disabled={!canRebind && option !== widget.kind && !(isChartKind(option) && isChartKind(widget.kind))}
            >
              {WIDGET_KIND_LABELS[option]}
            </option>
          ))}
        </select>
      </label>

      {canRebind && columns && columns.length > 0 && (isChart || kind === "kpi") ? (
        <div className="grid grid-cols-2 gap-2">
          {isChart ? (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">Categoria (X)</span>
              <select className={fieldCls} value={x} onChange={(event) => setX(event.target.value)}>
                <option value="">Automática</option>
                {columns.map((column) => (
                  <option key={column.name} value={column.name}>
                    {column.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {isChart ? (
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">Dividir em séries por</span>
              <select className={fieldCls} value={splitBy} onChange={(event) => setSplitBy(event.target.value)}>
                <option value="">Sem divisão</option>
                {columns
                  .filter((column) => column.name !== x && column.name !== y)
                  .map((column) => (
                    <option key={column.name} value={column.name}>
                      {column.name}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      {!canRebind ? (
        <p className="text-[10px] leading-snug text-muted-foreground">
          Sem consulta de origem: só o título e o tipo de gráfico podem mudar.
        </p>
      ) : null}
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}

      <div className="flex justify-end gap-1.5">
        <Button size="xs" variant="ghost" onClick={onClose} disabled={busy}>
          <X className="size-3" aria-hidden />
          Cancelar
        </Button>
        <Button size="xs" onClick={apply} disabled={busy || !title.trim()}>
          {busy ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <Check className="size-3" aria-hidden />}
          Aplicar
        </Button>
      </div>
    </div>
  );
};

type StudioTab = "visualizacoes" | "dashboards" | "notas";
const STUDIO_TABS: { id: StudioTab; label: string }[] = [
  { id: "visualizacoes", label: "Visualizações" },
  { id: "dashboards", label: "Dashboards" },
  { id: "notas", label: "Notas" },
];

const WidgetCard = ({ notebookId, widget }: { notebookId: string; widget: PanelWidget }) => {
  const removeWidget = usePanelStore((state) => state.removeWidget);
  const updateWidget = usePanelStore((state) => state.updateWidget);
  const [editing, setEditing] = useState(false);

  // visualizações salvas antes da correção ficaram sem os dados do gráfico (apareciam como a série de
  // demonstração): refaz a partir da consulta de origem e grava.
  useEffect(() => {
    if (!isChartKind(widget.kind) || widget.chart || widget.series || !widget.resultId) return;
    let cancelled = false;
    fetchResult(widget.resultId)
      .then((result) => {
        if (cancelled) return;
        const rebuilt = widgetDataFromResult(result, widget.kind, {
          x: widget.xCol,
          y: widget.yCol,
          ys: widget.ysCols,
          splitBy: widget.splitBy,
        });
        updateWidget(notebookId, widget.id, { chart: rebuilt.chart, ysCols: rebuilt.ysCols, splitBy: rebuilt.splitBy });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [notebookId, updateWidget, widget.chart, widget.series, widget.id, widget.kind, widget.resultId, widget.xCol, widget.yCol, widget.ysCols, widget.splitBy]);

  return (
    <article className="flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <header className="flex items-center gap-2 border-b border-border/70 bg-muted/30 px-3 py-1.5">
        <h3 className="min-w-0 flex-1 truncate text-xs font-medium text-foreground" title={widget.title}>
          {widget.title}
        </h3>
        <span className="shrink-0 rounded-full border border-border bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {WIDGET_KIND_LABELS[widget.kind]}
        </span>
        <button
          type="button"
          aria-label={`Editar ${widget.title}`}
          aria-pressed={editing}
          title="Editar"
          onClick={() => setEditing((value) => !value)}
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            editing && "bg-primary/10 text-primary",
          )}
        >
          <Pencil className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Remover ${widget.title}`}
          title="Remover"
          onClick={() => removeWidget(notebookId, widget.id)}
          className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </header>
      {editing ? <WidgetEditor notebookId={notebookId} widget={widget} onClose={() => setEditing(false)} /> : null}
      <div className="max-h-72 overflow-auto p-2">
        <WidgetView kind={widget.kind} data={widget} />
      </div>
      {widget.resultId ? <QueryInfo resultId={widget.resultId} /> : null}
    </article>
  );
};

/** Consulta e fonte por trás da visualização: dá para conferir de onde vêm os números. */
const QueryInfo = ({ resultId }: { resultId: string }) => {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<AnalyticResult | null>(null);
  const [failed, setFailed] = useState(false);
  const datasets = useDatasetsStore((state) => state.datasets);
  const role = useRole();

  useEffect(() => {
    if (!open || result) return;
    let cancelled = false;
    fetchResult(resultId)
      .then((value) => !cancelled && setResult(value))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [open, result, resultId]);

  const sourceName = datasets.find((entry) => entry.id === result?.sourceId)?.name;

  return (
    <div className="border-t border-border/70">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <Code2 className="size-3" aria-hidden />
        Ver consulta
        <ChevronDown className={cn("ml-auto size-3 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div className="space-y-2 px-3 pb-3">
          {failed ? <p className="text-[11px] text-destructive">Não foi possível carregar a consulta.</p> : null}
          {!result && !failed ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden /> : null}
          {result ? (
            <>
              <pre className="max-h-40 overflow-auto rounded-md border border-border/70 bg-muted/30 p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground">
                {result.sql}
              </pre>
              <p className="flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground tabular-nums">
                <span>{sourceName ?? "Fonte do projeto"}</span>
                <span>·</span>
                <span>
                  {result.rowCount.toLocaleString("pt-BR")} linhas{result.truncated ? " (parcial)" : ""}
                </span>
                <span>·</span>
                <span>{result.durationMs.toLocaleString("pt-BR")} ms</span>
                <span>·</span>
                <span>{new Date(result.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                {result.sourceId && role !== null && canManageData(role) ? (
                  <Link
                    href={`/fontes-de-dados/editor?${new URLSearchParams({ source: result.sourceId, sql: result.sql })}`}
                    className="ml-auto font-medium text-primary hover:underline"
                  >
                    Abrir no editor SQL
                  </Link>
                ) : null}
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const EmptyState = () => (
  <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
    <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
      <Database className="size-5" aria-hidden />
    </span>
    <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
      Peça um gráfico, indicador ou tabela ao assistente. A visualização aparece no chat: clique em
      &quot;Salvar visualização&quot; para guardá-la aqui.
    </p>
    <p className="text-xs text-muted-foreground/70">
      Depois você (ou o assistente) pode editar, e levar tudo para um dashboard.
    </p>
  </div>
);

/** Biblioteca de visualizações salvas do projeto (geradas no chat). */
export const WorkPanel = ({ className }: { className?: string }) => {
  const notebookId = useNotebookId();
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
  const widgets = (notebookId ? widgetsByNotebook[notebookId] : undefined) ?? EMPTY_WIDGETS;
  const loadPanel = usePanelStore((state) => state.load);
  const panelSaveError = usePanelStore((state) => state.saveError);
  const panelLoadError = usePanelStore((state) => (notebookId ? state.loadErrors[notebookId] : undefined));
  const notebooks = useNotebooksStore((state) => state.notebooks);
  const notebook = notebooks.find((entry) => entry.id === notebookId);
  const datasets = useDatasetsStore((state) => state.datasets);
  const activeSource = datasets.find((entry) => entry.id === notebook?.sourceId) ?? null;
  const renameDashboard = useDashboardsStore((state) => state.rename);
  const openDashboard = useDashboardsStore((state) => state.openDashboard);
  const createDashboard = useDashboardsStore((state) => state.createDashboard);
  const beginTransaction = useDashboardsStore((state) => state.beginTransaction);
  const addElement = useDashboardsStore((state) => state.addElement);
  const endTransaction = useDashboardsStore((state) => state.endTransaction);
  const saveDashboard = useDashboardsStore((state) => state.save);

  const [note, setNote] = useState<string | null>(null);
  const [studioTab, setStudioTab] = useState<StudioTab>("visualizacoes");
  const dashboardCount = useProjectDashboardIds(notebookId).length;
  const hydrateDashboards = useDashboardsStore((state) => state.hydrate);
  useEffect(() => hydrateDashboards(), [hydrateDashboards]);
  const noteCount = useNotesStore((state) => (notebookId ? state.notesByNotebook[notebookId]?.length ?? 0 : 0));
  useEffect(() => {
    if (notebookId) void useNotesStore.getState().load(notebookId);
  }, [notebookId]);
  const panelVisible = !panelCollapsed || panelMobileOpen;

  useEffect(() => {
    if (notebookId) void loadPanel(notebookId);
  }, [notebookId, loadPanel]);

  useEffect(() => {
    if (!note) return;
    const timeout = setTimeout(() => setNote(null), 4200);
    return () => clearTimeout(timeout);
  }, [note]);

  // mais recentes primeiro
  const filtered = useMemo(
    () =>
      widgets
        .filter((widget) => matchesTab(widget.kind, panelView))
        .sort((a, b) => b.z - a.z),
    [widgets, panelView],
  );

  const handleSaveAsDashboard = async () => {
    if (!notebookId || widgets.length === 0) {
      setNote("Salve visualizações antes de criar o dashboard.");
      return;
    }
    const title = notebook?.title?.trim() || "Dashboard do projeto";

    // visualizações vindas de consulta viram elementos ao vivo; as demais levam uma cópia dos dados
    const drafts = await Promise.all(
      widgets.map(async (widget) => {
        const live = widget.resultId
          ? await fetchResult(widget.resultId).then(liveFromResult, () => null)
          : null;
        return { widget, draft: draftFromWidget(widget, live, title) };
      }),
    );

    const id = createDashboard(notebookId);
    openDashboard(id);
    beginTransaction("panel-import");
    renameDashboard(title);
    // título no topo e visualizações em fluxo; a arrumação agrupa indicadores, gráficos e tabelas
    const heading = findLibraryItem("title");
    if (heading) addElement(heading, undefined, { content: title });
    for (const { draft } of drafts) {
      if (draft) addElement(draft.item, undefined, draft.props);
    }
    useDashboardsStore.getState().arrange();
    endTransaction();
    savePreferences();
    await saveDashboard();
    const { saveError } = useDashboardsStore.getState();
    const message = saveError
      ? `Não foi possível salvar o dashboard: ${saveError}`
      : `Dashboard "${title}" salvo.`;
    setNote(message);
    if (saveError) toast.error(message);
    else toast.success(message, { label: "Abrir dashboard", href: `/dashboards/${id}` });
  };

  return (
    <section
      data-slot="sigdata-work-panel"
      className={cn(
        "flex h-full w-full min-w-0 flex-1 flex-col bg-panel text-foreground",
        "border-s border-border",
        className,
      )}
      aria-label="Estúdio"
    >
      <header className="flex flex-col gap-2 border-b border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate pb-1 text-base font-medium text-foreground">Estúdio</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-primary">
                <BarChart3 className="size-3" aria-hidden />
                {activeSource ? activeSource.name : "Sem fonte selecionada"}
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            className="max-lg:hidden"
            onClick={togglePanelCollapsed}
            aria-label={panelCollapsed ? "Expandir visualizações" : "Recolher visualizações"}
            title={panelCollapsed ? "Expandir visualizações" : "Recolher visualizações"}
          >
            {panelCollapsed ? <Plus className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
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

      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {panelVisible ? (
          <div className="flex shrink-0 flex-col gap-3 px-3 pt-3">
          <StudioTools source={activeSource} widgetCount={widgets.length} onCreateDashboard={handleSaveAsDashboard} />

          <div
            role="tablist"
            aria-label="Conteúdo do estúdio"
            className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1"
          >
            {STUDIO_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={studioTab === tab.id}
                onClick={() => setStudioTab(tab.id)}
                className={cn(
                  "flex-1 whitespace-nowrap rounded-md px-1.5 py-1.5 text-xs font-medium transition-colors outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring/50",
                  studioTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                {tab.id === "visualizacoes" && widgets.length > 0 ? ` (${widgets.length})` : null}
                {tab.id === "dashboards" && dashboardCount > 0 ? ` (${dashboardCount})` : null}
                {tab.id === "notas" && noteCount > 0 ? ` (${noteCount})` : null}
              </button>
            ))}
          </div>
          </div>
        ) : null}
        {!panelVisible ? null : studioTab === "dashboards" ? (
          notebookId ? (
            <ProjectDashboardsPanel
              notebookId={notebookId}
              visualizationCount={widgets.length}
              onCreateFromVisualizations={handleSaveAsDashboard}
            />
          ) : null
        ) : studioTab === "notas" ? (
          notebookId ? <NotesPanel notebookId={notebookId} /> : null
        ) : (
          <div className="flex min-h-48 flex-1 flex-col">
            {panelLoadError && notebookId ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                <p className="text-sm font-medium text-foreground">Não foi possível carregar as visualizações</p>
                <p className="text-xs text-muted-foreground">{panelLoadError}</p>
                <Button size="xs" variant="outline" onClick={() => void loadPanel(notebookId)}>
                  Tentar novamente
                </Button>
              </div>
            ) : widgets.length === 0 || !notebookId ? (
              <EmptyState />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-1 px-3 pt-3">
                  {widgets.length >= 4 ? (
                    <select
                      aria-label="Filtrar visualizações"
                      value={panelView}
                      onChange={(event) => {
                        setPanelView(event.target.value as typeof panelView);
                        savePreferences();
                      }}
                      className="h-6 rounded-md border border-border bg-background px-1.5 text-[11px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {TABS.map((tab) => (
                        <option key={tab.id} value={tab.id}>
                          {tab.label}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {note ? <span className="text-[11px] text-muted-foreground">{note}</span> : null}
                  {panelSaveError ? (
                    <span className="text-[11px] text-destructive">Não salvo: {panelSaveError}</span>
                  ) : null}
                </div>
                {filtered.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
                    <p className="text-sm text-muted-foreground">Nenhuma visualização nesta categoria.</p>
                    <Button size="xs" variant="outline" onClick={() => setPanelView("todos")}>
                      Ver todas
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 p-3">
                    {filtered.map((widget) => (
                      <WidgetCard key={widget.id} notebookId={notebookId} widget={widget} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <p className="border-t border-border/60 px-4 py-2 text-[10px] text-muted-foreground/80">
        {activeSource ? (
          <>
            Fonte: {activeSource.name}
            <span className="ms-1.5 inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 align-middle">
              <Check className="size-3 text-primary" aria-hidden />
              {DATASET_KIND_LABELS[activeSource.kind]}
            </span>
          </>
        ) : (
          "Escolha um conjunto de dados na barra lateral para o assistente consultar."
        )}
      </p>
    </section>
  );
};
