"use client";

import { useMemo } from "react";
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

export const ChartView = ({ element }: { element: DashboardElement & { type: "chart" } }) => {
  const props = element.props;
  const { chartType, title, showTitle, subtitle, dataset, binding, color } = props;
  const live = useBindingData(element.id, binding, { ignoreFilters: props.ignoreFilters });
  const ctx = useDashboardData();
  // só gráficos agrupados por uma coluna (construtor) podem filtrar os demais
  const canSelect =
    ctx.interactive && props.crossFilter !== false && binding?.mode === "builder" && Boolean(binding.dimension) && chartType !== "gauge" && chartType !== "radar";
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
  const style = useMemo(
    () => ({
      ...props,
      legend: props.legend ?? (chartType === "pie" && props.showLegend === false ? "none" : "auto"),
      palette: props.palette?.length ? props.palette : pagePalette,
    }),
    [props, chartType, pagePalette],
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
            onSelect={canSelect ? (category) => ctx.toggleSelection(element.id, category) : undefined}
          />
        )}
      </div>
    </div>
  );
};
