"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BookmarkPlus,
  Check,
  ChevronRight,
  Database,
  Loader2,
  Minus,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  DEMO_NOTICE,
  DEMO_SOURCE,
  KPIS,
  MUNICIPIOS,
  RESUMOS,
  SERIE_TEMPORAL,
} from "@/lib/demo-data";
import { saveAnalysis } from "@/lib/dashboards/analyses";
import { useSigdata, type PanelView } from "@/lib/sigdata-store";
import { BarChart, ChartFrame, DataTable, KpiGrid, LineChart } from "./visualizations";

const PROJECT_NAME = "Análise de indicadores municipais";

const VIEWS: { id: PanelView; label: string }[] = [
  { id: "grafico", label: "Gráficos" },
  { id: "tabela", label: "Tabela" },
  { id: "indicadores", label: "Indicadores" },
];

const StatusChip = ({ status }: { status: "loading" | "ready" | "error" }) => {
  const config = {
    loading: {
      icon: Loader2,
      label: "Carregando",
      className: "text-muted-foreground",
      animate: true,
    },
    ready: {
      icon: BarChart3,
      label: DEMO_NOTICE,
      className: "text-primary",
      animate: false,
    },
    error: {
      icon: AlertTriangle,
      label: "Indisponível",
      className: "text-destructive",
      animate: false,
    },
  }[status];

  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium",
        config.className,
      )}
    >
      <Icon className={cn("size-3", config.animate && "animate-spin")} aria-hidden />
      {config.label}
    </span>
  );
};

const EmptyState = () => (
  <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
    <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
      <Database className="size-5" aria-hidden />
    </span>
    <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
      Gráficos, tabelas e análises poderão aparecer nesta área conforme você conversa com o
      assistente.
    </p>
    <p className="text-xs text-muted-foreground/70">
      Nesta etapa, o painel mostra visualizações de demonstração.
    </p>
  </div>
);

const LoadingState = () => (
  <div className="flex flex-col gap-4 p-4">
    <div className="grid grid-cols-2 gap-3">
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
    <Skeleton className="h-56" />
    <Skeleton className="h-40" />
  </div>
);

const ErrorState = ({ onRetry }: { onRetry: () => void }) => (
  <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
    <span className="flex size-11 items-center justify-center rounded-xl border border-destructive/40 bg-destructive/10 text-destructive">
      <AlertTriangle className="size-5" aria-hidden />
    </span>
    <p className="max-w-xs text-sm text-muted-foreground">
      Não foi possível carregar as visualizações de demonstração.
    </p>
    <Button size="sm" variant="outline" onClick={onRetry}>
      Tentar novamente
    </Button>
  </div>
);

const SummaryList = () => (
  <div className="@container w-full">
    <div className="flex flex-col gap-2 @sm:grid @sm:grid-cols-2 @sm:items-start">
      {RESUMOS.map((item) => (
        <div key={item.titulo} className="rounded-lg border border-border bg-card px-3.5 py-3">
          <p className="text-xs font-medium text-foreground">{item.titulo}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.texto}</p>
        </div>
      ))}
    </div>
  </div>
);

const ReadyContent = ({ view }: { view: PanelView }) => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground/80">
      <span>{DEMO_SOURCE}</span>
      <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5">
        <Check className="size-3 text-primary" aria-hidden />
        demonstração
      </span>
    </div>

    {view === "grafico" && (
      <>
        <ChartFrame title="Série mensal do índice" caption="2024">
          <LineChart data={SERIE_TEMPORAL} />
        </ChartFrame>
        <ChartFrame title="Comparativo por período" caption="base 0–100">
          <BarChart data={SERIE_TEMPORAL} />
        </ChartFrame>
        <SummaryList />
      </>
    )}

    {view === "tabela" && <DataTable rows={MUNICIPIOS} />}

    {view === "indicadores" && (
      <>
        <KpiGrid items={KPIS} />
        <SummaryList />
      </>
    )}
  </div>
);

export const WorkPanel = ({ className }: { className?: string }) => {
  const {
    demoStatus,
    panelView,
    panelCollapsed,
    panelMobileOpen,
    savedAt,
    setPanelView,
    togglePanelCollapsed,
    setPanelMobileOpen,
    loadDemo,
    savePreferences,
  } = useSigdata();

  const [note, setNote] = useState<string | null>(null);
  const panelVisible = !panelCollapsed || panelMobileOpen;

  useEffect(() => {
    if (panelVisible && demoStatus === "idle") loadDemo();
  }, [panelVisible, demoStatus, loadDemo]);

  useEffect(() => {
    if (!note) return;
    const timeout = setTimeout(() => setNote(null), 4200);
    return () => clearTimeout(timeout);
  }, [note]);

  const handleSaveAnalysis = () => {
    const viewLabel = VIEWS.find((item) => item.id === panelView)?.label ?? "Painel";
    saveAnalysis(
      {
        kpis: KPIS,
        serie: SERIE_TEMPORAL,
        municipios: MUNICIPIOS,
        resumos: RESUMOS,
      },
      `${PROJECT_NAME} · ${viewLabel}`,
    );
    savePreferences();
    setNote('Análise salva — aparece em "Análises salvas" no editor de dashboards.');
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
      <header className="flex flex-col gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{PROJECT_NAME}</p>
            <div className="mt-1 flex items-center gap-2">
              <StatusChip status={demoStatus === "idle" ? "loading" : demoStatus} />
              {savedAt ? (
                <span className="text-[11px] text-muted-foreground">salvo localmente</span>
              ) : null}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={togglePanelCollapsed}
            aria-label={panelCollapsed ? "Expandir painel" : "Recolher painel"}
            title={panelCollapsed ? "Expandir painel" : "Recolher painel"}
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
            aria-label="Fechar painel"
            title="Fechar painel"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="xs" variant="outline" onClick={handleSaveAnalysis}>
            <BookmarkPlus className="size-3.5" aria-hidden />
            Salvar análise
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => setNote("Compartilhamento indisponível nesta demonstração.")}
          >
            Compartilhar
          </Button>
          {note ? <span className="text-[11px] text-muted-foreground">{note}</span> : null}
        </div>

        <div
          role="tablist"
          aria-label="Visualização do painel"
          className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1"
        >
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={panelView === item.id}
              onClick={() => setPanelView(item.id)}
              className={cn(
                "flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring/50",
                panelView === item.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {demoStatus === "loading" ? (
          <LoadingState />
        ) : demoStatus === "idle" ? (
          <EmptyState />
        ) : demoStatus === "error" ? (
          <ErrorState onRetry={loadDemo} />
        ) : demoStatus === "ready" ? (
          <div className="p-4">
            <ReadyContent view={panelView} />
          </div>
        ) : null}
      </div>
    </section>
  );
};
