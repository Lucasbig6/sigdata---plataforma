/**
 * Carrega o ECharts sob demanda (fora do bundle inicial) registrando só o que
 * o SIGDATA usa: todos os tipos de gráfico e os componentes de interação.
 */
type Core = typeof import("echarts/core");

let loading: Promise<Core> | null = null;

export const loadEcharts = (): Promise<Core> => {
  loading ??= Promise.all([
    import("echarts/core"),
    import("echarts/charts"),
    import("echarts/components"),
    import("echarts/renderers"),
  ]).then(([core, charts, components, renderers]) => {
    core.use([
      charts.BarChart,
      charts.LineChart,
      charts.PieChart,
      charts.ScatterChart,
      charts.RadarChart,
      charts.FunnelChart,
      charts.GaugeChart,
      charts.TreemapChart,
      charts.HeatmapChart,
      components.GridComponent,
      components.TooltipComponent,
      components.LegendComponent,
      components.DataZoomComponent,
      components.VisualMapComponent,
      components.MarkLineComponent,
      components.RadarComponent,
      components.TitleComponent,
      components.ToolboxComponent,
      renderers.SVGRenderer,
    ]);
    return core;
  });
  return loading;
};
