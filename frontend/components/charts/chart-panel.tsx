"use client";

import { useMemo } from "react";
import { buildChartOption } from "@/lib/charts/build-option";
import { themePalette, useChartTheme } from "@/lib/charts/theme";
import type { ChartData, ChartStyle, ChartType } from "@shared/charts/types";
import type { ChartColor } from "@shared/dashboards/types";
import { EChart, type ChartClick } from "./echart";

type Props = {
  type: ChartType;
  data: ChartData;
  style?: ChartStyle & { showGrid?: boolean };
  /** Cor-base do tema (1–5) quando não há paleta personalizada. */
  color?: ChartColor;
  className?: string;
  label?: string;
  /** Categoria selecionada (as demais ficam esmaecidas). */
  selected?: string | null;
  /** Clique numa categoria; ausente = gráfico só de leitura. */
  onSelect?: (category: string) => void;
  /** Bordas do gráfico */
  border?: { width?: number; color?: string; style?: "solid" | "dashed" | "dotted" };
};

/** Gráfico completo (tema + paleta + opção do ECharts) pronto para usar. */
export const ChartPanel = ({ type, data, style, color = 2, className, label, selected, onSelect, border }: Props) => {
  const theme = useChartTheme();
  const option = useMemo(() => {
    const resolvedStyle = style ?? {};
    const palette = resolvedStyle.palette?.length ? resolvedStyle.palette : themePalette(theme, color);
    return buildChartOption({ type, style: resolvedStyle, data, theme, palette, selected });
  }, [type, style, data, theme, color, selected]);
  const handleClick = onSelect
    ? (click: ChartClick) => {
        // mapa de calor: o valor traz [índice da categoria, índice da série, valor]
        const category =
          type === "heatmap" && Array.isArray(click.value)
            ? data.categories[Number(click.value[0])]
            : click.name;
        if (category !== undefined && data.categories.includes(category)) onSelect(category);
      }
    : undefined;
  // borda pode vir como prop dedicada ou dentro do próprio estilo do gráfico
  const resolvedBorder = border ?? (style ?? {}).border;
  return (
    <EChart
      option={option}
      onClick={handleClick}
      className={className}
      label={label}
      border={resolvedBorder}
    />
  );
};
