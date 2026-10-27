import { ChartPanel } from "@/components/charts/chart-panel";
import { MUNICIPIOS, SERIE_TEMPORAL } from "@/lib/demo-data";
import type { ChartData } from "@shared/charts/types";
import { WIDGET_CHART_TYPE } from "@shared/panel";
import type { WidgetData, WidgetKind } from "@/lib/panel/store";
import { DataTable, KpiGrid, ResultTable } from "./visualizations";

/** Dados do gráfico: o formato novo (várias séries) ou a série única antiga. */
const chartDataOf = (data: WidgetData): ChartData => {
  if (data.chart) return data.chart;
  const points = data.series ?? SERIE_TEMPORAL;
  return {
    categories: points.map((point) => point.label),
    series: [{ name: "Valor", values: points.map((point) => point.valor) }],
  };
};

/** Desenha uma visualização (gráfico, indicadores ou tabela) a partir dos dados do widget. */
export const WidgetView = ({ kind, data }: { kind: WidgetKind; data: WidgetData }) => {
  const chartType = WIDGET_CHART_TYPE[kind];
  if (chartType) {
    return (
      <div className="h-60 w-full">
        <ChartPanel type={chartType} data={chartDataOf(data)} label="Gráfico" border={data.border} />
      </div>
    );
  }
  if (kind === "kpi") return <KpiGrid items={data.kpis ?? []} />;
  if (data.table) return <ResultTable columns={data.table.columns} rows={data.table.rows} />;
  return <DataTable rows={data.rows ?? MUNICIPIOS} />;
};
