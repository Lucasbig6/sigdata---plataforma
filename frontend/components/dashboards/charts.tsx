"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ChartPanel } from "@/components/charts/chart-panel";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { resolveSeries } from "@/lib/dashboards/datasets";
import { isBindingReady, toChartData, useBindingData, useDashboardData } from "@/lib/dashboards/live-data";
import type { ChartData } from "@shared/charts/types";
import type { DashboardElement } from "@/lib/dashboards/types";
import { frameCss } from "@/lib/dashboards/frame";
import { DataError, DataSkeleton, RefreshingDot } from "./data-state";

const CHART_PADDING = 12;

export { useChartTheme } from "@/lib/charts/theme";

const EmptyNote = () => (
  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
    Sem dados para este recorte.
  </div>
);

const ChartTitle = ({
  title,
  showTitle,
  subtitle,
}: {
  title: string;
  showTitle: boolean;
  subtitle: string;
}) =>
  showTitle || subtitle ? (
    <div className="shrink-0 px-1 pb-2">
      {showTitle ? <p className="truncate text-sm font-medium text-foreground">{title}</p> : null}
      {subtitle ? <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p> : null}
    </div>
  ) : null;

/** Trilha do drill-down: "Todos › SP › Campinas"; clicar num nível volta até ele. */
const DrillTrail = ({ path, onBack }: { path: { column: string; value: string }[]; onBack: (length: number) => void }) => (
  <nav aria-label="Níveis do detalhamento" className="flex shrink-0 flex-wrap items-center gap-0.5 px-1 pb-1.5 text-[11px]">
    <button type="button" onClick={() => onBack(0)} className="rounded px-1 text-primary hover:bg-muted">
      Todos
    </button>
    {path.map((step, index) => (
      <span key={`${step.column}:${step.value}`} className="flex items-center gap-0.5">
        <ChevronRight className="size-3 text-muted-foreground" aria-hidden />
        {index === path.length - 1 ? (
          <span className="px-1 font-medium text-foreground">{step.value}</span>
        ) : (
          <button type="button" onClick={() => onBack(index + 1)} className="rounded px-1 text-primary hover:bg-muted">
            {step.value}
          </button>
        )}
      </span>
    ))}
  </nav>
);

export const ChartView = ({ element }: { element: DashboardElement & { type: "chart" } }) => {
  const props = element.props;
  const { chartType, title, showTitle, subtitle, dataset, binding, color } = props;
  const ctx = useDashboardData();

  // drill-down: dimensão do gráfico + níveis seguintes; o clique desce um nível em vez de filtrar os outros
  const levels = binding?.mode === "builder" && binding.dimension ? [binding.dimension, ...(binding.drill ?? [])] : [];
  const drillable = ctx.interactive && levels.length > 1;
  const [path, setPath] = useState<{ column: string; value: string }[]>([]);
  useEffect(() => {
    if (!drillable) setPath((current) => (current.length === 0 ? current : []));
  }, [drillable]);
  const level = Math.min(path.length, Math.max(levels.length - 1, 0));
  const live = useBindingData(element.id, binding, {
    ignoreFilters: props.ignoreFilters,
    drill: drillable && path.length > 0 ? { dimension: levels[level], path } : undefined,
  });
  // só gráficos agrupados por uma coluna (construtor) podem filtrar os demais
  const canSelect =
    !drillable && ctx.interactive && props.crossFilter !== false && binding?.mode === "builder" && Boolean(binding.dimension) && chartType !== "gauge" && chartType !== "radar";
  const canDrillDown = drillable && level < levels.length - 1;
  const selected = canSelect ? ctx.values[element.id] || null : null;
  const isLive = isBindingReady(binding);
  const liveData = live.status === "ready" || live.status === "loading" ? live.data : undefined;

  const chartData = useMemo<ChartData>(() => {
    if (isLive) return liveData ? toChartData(binding, liveData) : { categories: [], series: [] };
    const points = resolveSeries(dataset) as { label: string; valor: number }[];
    return {
      categories: points.map((point) => point.label),
      series: [{ name: "Valor", values: points.map((point) => point.valor) }],
    };
  }, [isLive, liveData, binding, dataset]);

  // paleta do painel: vale para gráficos sem cores próprias
  const pagePalette = useDashboardsStore((state) =>
    state.currentId ? state.dashboards[state.currentId]?.canvas.palette : undefined,
  );

  // gráficos antigos: pizza sem legenda continuava sem legenda
  const lastStep = path.at(-1)?.value ?? "";
  const style = useMemo(
    () => ({
      ...props,
      legend: props.legend ?? (chartType === "pie" && props.showLegend === false ? "none" : "auto"),
      palette: props.palette?.length ? props.palette : pagePalette,
      // mapa depois de escolher uma UF: mostra só os municípios dela
      ...((chartType === "map" || chartType === "mapbubbles") && /^[A-Za-z]{2}$/.test(lastStep)
        ? { mapScope: "municipio" as const, mapRegion: lastStep.toUpperCase() }
        : {}),
    }),
    [props, chartType, pagePalette, lastStep],
  );

  if (isLive && !liveData) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden" style={frameCss(props.frame, CHART_PADDING)}>
        <ChartTitle title={title} showTitle={showTitle} subtitle={subtitle} />
        <div className="min-h-0 flex-1">
          {live.status === "error" ? <DataError message={live.error} /> : <DataSkeleton />}
        </div>
      </div>
    );
  }

  const empty = chartData.categories.length === 0 || chartData.series.length === 0;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden" style={frameCss(props.frame, CHART_PADDING)}>
      <RefreshingDot state={live} />
      <ChartTitle title={title} showTitle={showTitle} subtitle={subtitle} />
      {path.length > 0 ? <DrillTrail path={path} onBack={(length) => setPath((current) => current.slice(0, length))} /> : null}
      <div className="min-h-0 w-full flex-1">
        {empty ? (
          <EmptyNote />
        ) : (
          <ChartPanel
            type={chartType}
            data={chartData}
            style={style}
            color={color}
            label={title}
            selected={selected}
            onSelect={
              canDrillDown
                ? (category) => setPath((current) => [...current, { column: levels[Math.min(current.length, levels.length - 1)], value: category }])
                : canSelect
                  ? (category) => ctx.toggleSelection(element.id, category)
                  : undefined
            }
          />
        )}
      </div>
    </div>
  );
};
