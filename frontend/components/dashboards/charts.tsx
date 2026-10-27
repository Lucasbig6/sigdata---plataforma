"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "next-themes";
import { resolveSeries } from "@/lib/dashboards/datasets";
import { isBindingReady, toSeries, useBindingData } from "@/lib/dashboards/live-data";
import { DataError, DataSkeleton, RefreshingDot } from "./data-state";
import type { ChartColor, DashboardElement } from "@/lib/dashboards/types";

/** Cores de série (espelham --chart-1..5 em globals.css) por tema. */
const LIGHT_CHART_COLORS: Record<ChartColor, string> = {
  1: "oklch(0.646 0.222 41.116)",
  2: "oklch(0.511 0.086 186.4)",
  3: "oklch(0.45 0.11 253)",
  4: "oklch(0.6 0.13 150)",
  5: "oklch(0.66 0.15 35)",
};

const DARK_CHART_COLORS: Record<ChartColor, string> = {
  1: "oklch(0.8 0.14 75)",
  2: "oklch(0.78 0.1 186)",
  3: "oklch(0.72 0.11 253)",
  4: "oklch(0.78 0.14 150)",
  5: "oklch(0.75 0.14 35)",
};

const PIE_ORDER: ChartColor[] = [2, 4, 3, 5, 1];

const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

const formatter = (value: unknown) =>
  value === undefined || value === null ? "—" : nf.format(Number(value));

type ChartTheme = {
  colors: Record<ChartColor, string>;
  axis: string;
  grid: string;
  axisLine: string;
  pieStroke: string;
  labelFill: string;
  tooltip: {
    contentStyle: React.CSSProperties;
    labelStyle: React.CSSProperties;
    itemStyle: React.CSSProperties;
    formatter: typeof formatter;
  };
};

const LIGHT_CHART_THEME: ChartTheme = {
  colors: LIGHT_CHART_COLORS,
  axis: "oklch(0.5 0.025 250)",
  grid: "oklch(0.329 0.101 253 / 10%)",
  axisLine: "oklch(0.329 0.101 253 / 22%)",
  pieStroke: "oklch(0.329 0.101 253 / 30%)",
  labelFill: "oklch(0.28 0.045 250)",
  tooltip: {
    contentStyle: {
      background: "#ffffff",
      border: "1px solid oklch(0.329 0.101 253 / 18%)",
      borderRadius: 10,
      fontSize: 12,
      color: "oklch(0.28 0.045 250)",
      boxShadow: "0 8px 24px rgba(0, 20, 50, 0.14)",
    },
    labelStyle: { color: "oklch(0.5 0.025 250)", fontSize: 11 },
    itemStyle: { color: "oklch(0.28 0.045 250)" },
    formatter,
  },
};

const DARK_CHART_THEME: ChartTheme = {
  colors: DARK_CHART_COLORS,
  axis: "#8A989C",
  grid: "rgba(255, 255, 255, 0.07)",
  axisLine: "rgba(255, 255, 255, 0.12)",
  pieStroke: "rgba(22, 28, 30, 0.85)",
  labelFill: "#E8ECEF",
  tooltip: {
    contentStyle: {
      background: "#161C1E",
      border: "1px solid rgba(255, 255, 255, 0.12)",
      borderRadius: 10,
      fontSize: 12,
      color: "#E8ECEF",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
    },
    labelStyle: { color: "#9FB0B4", fontSize: 11 },
    itemStyle: { color: "#E8ECEF" },
    formatter,
  },
};

export const useChartTheme = (): ChartTheme => {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? DARK_CHART_THEME : LIGHT_CHART_THEME;
};

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
  const { chartType, title, showTitle, subtitle, dataset, binding, color, showGrid, showLegend } =
    element.props;
  const live = useBindingData(element.id, binding);
  const chartTheme = useChartTheme();
  const isLive = isBindingReady(binding);
  const liveData = live.status === "ready" || live.status === "loading" ? live.data : undefined;
  const data = isLive
    ? liveData
      ? toSeries(binding, liveData)
      : []
    : (resolveSeries(dataset) as { label: string; valor: number }[]);

  if (isLive && !liveData) {
    return (
      <div className="flex h-full w-full flex-col">
        <ChartTitle title={title} showTitle={showTitle} subtitle={subtitle} />
        <div className="min-h-0 flex-1">
          {live.status === "error" ? <DataError message={live.error} /> : <DataSkeleton />}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-full w-full flex-col">
        <ChartTitle title={title} showTitle={showTitle} subtitle={subtitle} />
        <div className="min-h-0 flex-1">
          <EmptyNote />
        </div>
      </div>
    );
  }

  const stroke = chartTheme.colors[color] ?? chartTheme.colors[2];
  const axisProps = {
    tick: { fill: chartTheme.axis, fontSize: 11 },
    axisLine: { stroke: chartTheme.axisLine },
    tickLine: false as const,
  };

  const body = (() => {
    if (chartType === "pie") {
      const pieData = data.map((point) => ({ name: point.label, value: point.valor }));
      return (
        <PieChart>
          {showLegend ? (
            <Legend
              iconSize={9}
              wrapperStyle={{ fontSize: 11, color: chartTheme.axis }}
              formatter={(value: string) => (
                <span className="text-[11px] text-muted-foreground">
                  {value.length > 16 ? `${value.slice(0, 16)}…` : value}
                </span>
              )}
            />
          ) : null}
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy={showLegend ? "46%" : "50%"}
            outerRadius={showLegend ? "72%" : "82%"}
            stroke={chartTheme.pieStroke}
            strokeWidth={2}
            label={
              data.length <= 6 && !showLegend ? { fill: chartTheme.labelFill, fontSize: 11 } : false
            }
          >
            {pieData.map((_, index) => (
              <Cell key={index} fill={chartTheme.colors[PIE_ORDER[index % PIE_ORDER.length]]} />
            ))}
          </Pie>
          <Tooltip {...chartTheme.tooltip} />
        </PieChart>
      );
    }

    const xAxis = (
      <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
    );
    const yAxis = <YAxis {...axisProps} axisLine={false} width={40} />;
    const grid = showGrid ? (
      <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
    ) : null;
    const tooltip = <Tooltip {...chartTheme.tooltip} cursor={{ stroke: chartTheme.axisLine }} />;

    if (chartType === "line") {
      return (
        <LineChart margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          {grid}
          {xAxis}
          {yAxis}
          <Line
            type="monotone"
            dataKey="valor"
            stroke={stroke}
            strokeWidth={2.25}
            dot={false}
            activeDot={{ r: 4 }}
          />
          {tooltip}
        </LineChart>
      );
    }

    if (chartType === "area") {
      return (
        <AreaChart margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          {grid}
          {xAxis}
          {yAxis}
          <Area
            type="monotone"
            dataKey="valor"
            stroke={stroke}
            strokeWidth={2.25}
            fill={stroke}
            fillOpacity={0.18}
            activeDot={{ r: 4 }}
          />
          {tooltip}
        </AreaChart>
      );
    }

    return (
      <BarChart margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        {grid}
        {xAxis}
        {yAxis}
        <Bar
          dataKey="valor"
          fill={stroke}
          radius={[4, 4, 0, 0]}
          maxBarSize={64}
          isAnimationActive={false}
        />
        {tooltip}
      </BarChart>
    );
  })();

  return (
    <div className="relative flex h-full w-full flex-col">
      <RefreshingDot state={live} />
      <ChartTitle title={title} showTitle={showTitle} subtitle={subtitle} />
      <div className="min-h-0 w-full flex-1" style={{ minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          {body}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
