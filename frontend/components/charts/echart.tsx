"use client";

import type { ECharts, EChartsCoreOption } from "echarts/core";
import { useEffect, useRef } from "react";
import { loadEcharts } from "@/lib/charts/echarts";

/** Dados do item clicado (nome da categoria e, no mapa de calor, o índice no valor). */
export type ChartClick = { name?: string; value?: unknown; seriesName?: string };

type Props = {
  option: EChartsCoreOption;
  onClick?: (click: ChartClick) => void;
  className?: string;
  label?: string;
  border?: { width?: number; color?: string; style?: "solid" | "dashed" | "dotted" };
};

/** Aplica a borda do gráfico (raiz do ECharts) quando especificada. */
const applyBorder = (instance: ECharts, border: Props["border"]) => {
  if (border?.width !== undefined || border?.color) {
    instance.setOption({
      borderColor: border.color,
      borderWidth: border.width,
      borderType: border?.style,
    });
  }
};

/** Gráfico do ECharts (SVG: vetorial, nítido em qualquer zoom do painel) que acompanha o tamanho do contêiner e libera recursos ao sair. */
export const EChart = ({ option, onClick, className, label, border }: Props) => {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<ECharts | null>(null);
  const latest = useRef(option);
  latest.current = option;
  const clickRef = useRef(onClick);
  clickRef.current = onClick;
  const borderRef = useRef(border);
  borderRef.current = border;

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    void loadEcharts().then((echarts) => {
      const element = host.current;
      if (disposed || !element) return;
      const instance = echarts.init(element, undefined, { renderer: "svg" });
      chart.current = instance;
      instance.setOption(latest.current, true);
      applyBorder(instance, borderRef.current);
      instance.on("click", (params) => clickRef.current?.(params as ChartClick));
      observer = new ResizeObserver(() => instance.resize());
      observer.observe(element);
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chart.current) return;
    chart.current.setOption(option, true);
    applyBorder(chart.current, border);
  }, [option, border]);

  return (
    <div
      ref={host}
      role="img"
      aria-label={label ?? "Gráfico"}
      className={className ?? "h-full w-full"}
      style={onClick ? { cursor: "pointer" } : undefined}
    />
  );
};