/**
 * Conversão de visualizações do workspace (widgets do painel analítico) em
 * elementos de dashboard. Com consulta de origem o elemento nasce ligado ao
 * vivo (SQL na fonte); sem ela leva uma cópia dos dados como análise salva.
 */
import { saveAnalysis } from "@/lib/dashboards/analyses";
import { findLibraryItem, type LibraryItem } from "@/lib/dashboards/presets";
import type { DataBinding } from "@/lib/dashboards/types";
import type { AnalyticResult, ResultColumn } from "@/lib/domain/sources";
import type { PanelWidget, WidgetKind } from "@/lib/panel/store";
import type { WorkspaceVisual } from "@shared/dashboards/workspace";
import { WIDGET_CHART_TYPE, isChartKind } from "@shared/panel";

const ITEM_KEY: Record<WidgetKind, string> = {
  linha: "line",
  barras: "bar",
  barras_h: "hbar",
  area: "area",
  combo: "combo",
  pizza: "pie",
  rosca: "donut",
  dispersao: "scatter",
  radar: "radar",
  funil: "funnel",
  medidor: "gauge",
  treemap: "treemap",
  calor: "heatmap",
  kpi: "kpi",
  tabela: "table",
};

export type ElementDraft = { item: LibraryItem; props: Record<string, unknown> };

type LiveQuery = { sourceId: string; sql: string; columns: ResultColumn[] };

export const liveFromResult = (result: AnalyticResult): LiveQuery | null =>
  result.sourceId ? { sourceId: result.sourceId, sql: result.sql, columns: result.columns } : null;

const bindingFor = (widget: PanelWidget, live: LiveQuery): DataBinding => {
  const has = (name: string | undefined) => Boolean(name) && live.columns.some((c) => c.name === name);
  const x = has(widget.xCol) ? widget.xCol : live.columns.find((c) => c.kind !== "numero")?.name;
  const numeric = live.columns.filter((c) => c.kind === "numero");
  const kpiLabel = widget.kpis?.[0]?.label;
  const y = has(widget.yCol)
    ? widget.yCol
    : widget.kind === "kpi" && has(kpiLabel)
      ? kpiLabel
      : (numeric.find((c) => c.name !== x)?.name ?? numeric[0]?.name);
  return {
    sourceId: live.sourceId,
    mode: "sql",
    sql: live.sql,
    ...(widget.kind !== "tabela" && { x, y }),
    ...(isChartKind(widget.kind) && widget.ysCols?.length && { ys: widget.ysCols }),
    ...(isChartKind(widget.kind) && widget.splitBy && { splitBy: widget.splitBy }),
  };
};

/** Props de cópia estática (sem consulta de origem): guarda os dados como análise. */
const snapshotProps = (widget: PanelWidget, title: string): Record<string, unknown> => {
  if (widget.kind === "kpi") {
    const kpi = widget.kpis?.[0];
    return kpi ? { title: kpi.label, value: kpi.value, description: widget.title } : {};
  }
  const firstSeries = widget.chart?.series[0];
  const serie =
    widget.series ??
    (firstSeries
      ? widget.chart!.categories.map((label, index) => ({ label, valor: firstSeries.values[index] ?? 0 }))
      : undefined);
  if (!serie && !widget.table && !widget.rows) return {};
  const analysis = saveAnalysis(
    {
      kpis: widget.kpis ?? [],
      serie: serie ?? [],
      municipios: widget.rows ?? [],
      resumos: [],
      ...(widget.table && { tabela: widget.table }),
    },
    `${title} · ${widget.title}`,
  );
  return { dataset: { source: "analysis", ref: analysis.id, categoryField: "periodo", valueField: "valor" } };
};

export const draftFromWidget = (
  widget: PanelWidget,
  live: LiveQuery | null,
  sourceTitle: string,
): ElementDraft | null => {
  const item = findLibraryItem(ITEM_KEY[widget.kind]);
  if (!item) return null;
  const base: Record<string, unknown> = { title: widget.title, showTitle: true };
  const chartType = WIDGET_CHART_TYPE[widget.kind];
  if (chartType) base.chartType = chartType;

  if (live) {
    const props: Record<string, unknown> = { ...base, binding: bindingFor(widget, live) };
    if (widget.kind === "kpi") {
      props.title = widget.kpis?.[0]?.label ?? widget.title;
      props.description = widget.title;
    }
    return { item, props };
  }
  return { item, props: { ...base, ...snapshotProps(widget, sourceTitle) } };
};

export const draftFromVisual = (visual: WorkspaceVisual, projectTitle: string) =>
  draftFromWidget(visual.widget, visual.live, projectTitle);
