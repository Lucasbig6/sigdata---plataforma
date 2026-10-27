"use client";

import { useTheme } from "next-themes";
import type { ChartColor } from "@shared/dashboards/types";

/** Cores de série por tema (hex: o ECharts não interpreta oklch). */
const LIGHT_CHART_COLORS: Record<ChartColor, string> = {
  1: "#E4572E",
  2: "#177F76",
  3: "#2F5F9E",
  4: "#3E9B5F",
  5: "#E5714A",
};

const DARK_CHART_COLORS: Record<ChartColor, string> = {
  1: "#EDBB4A",
  2: "#5FCDC1",
  3: "#7FA8E8",
  4: "#6FD39A",
  5: "#F59C7C",
};

/** Cores extras para gráficos com muitas séries. */
const LIGHT_EXTRA = ["#7C5CBF", "#C2417B", "#5B7083"];
const DARK_EXTRA = ["#B39DDB", "#F48FB1", "#90A4AE"];

export type ChartTheme = {
  dark: boolean;
  colors: Record<ChartColor, string>;
  extra: string[];
  text: string;
  muted: string;
  grid: string;
  axisLine: string;
  surface: string;
  tooltipBg: string;
  tooltipBorder: string;
  /** Contorno entre fatias/células. */
  stroke: string;
};

const LIGHT: ChartTheme = {
  dark: false,
  colors: LIGHT_CHART_COLORS,
  extra: LIGHT_EXTRA,
  text: "#1F2A37",
  muted: "#5A6B78",
  grid: "rgba(31, 42, 55, 0.10)",
  axisLine: "rgba(31, 42, 55, 0.22)",
  surface: "#ffffff",
  tooltipBg: "#ffffff",
  tooltipBorder: "rgba(31, 42, 55, 0.18)",
  stroke: "#ffffff",
};

const DARK: ChartTheme = {
  dark: true,
  colors: DARK_CHART_COLORS,
  extra: DARK_EXTRA,
  text: "#E8ECEF",
  muted: "#8A989C",
  grid: "rgba(255, 255, 255, 0.07)",
  axisLine: "rgba(255, 255, 255, 0.12)",
  surface: "#161C1E",
  tooltipBg: "#161C1E",
  tooltipBorder: "rgba(255, 255, 255, 0.12)",
  stroke: "#161C1E",
};

export const useChartTheme = (): ChartTheme => {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? DARK : LIGHT;
};

const ORDER: ChartColor[] = [2, 4, 3, 5, 1];

/** Paleta das séries: a cor escolhida primeiro, depois as demais do tema. */
export const themePalette = (theme: ChartTheme, base: ChartColor = 2): string[] => [
  theme.colors[base] ?? theme.colors[2],
  ...ORDER.filter((color) => color !== base).map((color) => theme.colors[color]),
  ...theme.extra,
];
