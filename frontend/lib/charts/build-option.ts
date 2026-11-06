/**
 * Converte tipo + estilo + dados em uma opção do ECharts. É uma função pura:
 * o mesmo resultado desenha o gráfico do dashboard, do chat e dos salvos.
 */
import type { EChartsCoreOption } from "echarts/core";
import type { ChartData, ChartStyle, ChartType } from "@shared/charts/types";
import { formatNumber } from "@/lib/dashboards/format";
import type { GeoBundle } from "./geo";
import type { ChartTheme } from "./theme";

type AnyRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is AnyRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Mescla `patch` em `base` (objetos em profundidade; arrays e valores substituem). */
const deepMerge = (base: AnyRecord, patch: AnyRecord): AnyRecord => {
  const out: AnyRecord = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const current = out[key];
    out[key] = isRecord(current) && isRecord(value) ? deepMerge(current, value) : value;
  }
  return out;
};

/** JSON avançado do usuário; texto inválido é ignorado (o editor avisa). */
export const parseAdvanced = (text: string | undefined): AnyRecord | null => {
  if (!text?.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export type BuildInput = {
  type: ChartType;
  style: ChartStyle & { showGrid?: boolean };
  data: ChartData;
  theme: ChartTheme;
  /** Paleta efetiva (já resolvida: personalizada ou do tema). */
  palette: string[];
  /** Categoria em destaque (filtro cruzado): as outras ficam esmaecidas. */
  selected?: string | null;
  /** Malha dos mapas (obrigatória para os tipos de mapa). */
  geo?: GeoBundle | null;
};

const CARTESIAN: ChartType[] = ["bar", "hbar", "line", "area", "combo", "scatter"];
export const isCartesian = (type: ChartType) => CARTESIAN.includes(type);

const niceMax = (value: number) => {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
};

const DIM = 0.28;

/** Séries de latitude, longitude e valor: pelo nome da coluna (lat/lng/lon/valor) ou, sem pistas, pela ordem. */
const pickCoordinates = (data: ChartData) => {
  const named = (pattern: RegExp) => data.series.find((s) => pattern.test(s.name.trim().toLowerCase()));
  const lat = named(/^(lat|latitude|y)$|latitude/) ?? data.series[0];
  const lng = named(/^(lng|lon|long|longitude|x)$|longitude/) ?? data.series.find((s) => s !== lat);
  const value = data.series.find((s) => s !== lat && s !== lng);
  return { lat, lng, value };
};

/** Mapa de pontos: cada linha é um ponto em [longitude, latitude]; o tamanho acompanha o valor, se houver. */
const buildPointsOption = (
  { style, data, theme, palette, selected, geo }: BuildInput,
  base: AnyRecord,
  format: (value: unknown) => string,
): AnyRecord => {
  if (!geo) return { ...base, series: [] };
  const { lat, lng, value } = pickCoordinates(data);
  const points: { name: string; coord: [number, number]; value: number | null }[] = [];
  let invalid = 0;
  data.categories.forEach((name, index) => {
    const y = lat?.values[index];
    const x = lng?.values[index];
    if (y == null || x == null || Math.abs(y) > 90 || Math.abs(x) > 180) {
      invalid += 1;
      return;
    }
    points.push({ name, coord: [x, y], value: value?.values[index] ?? null });
  });
  const sized = points.filter((p) => p.value !== null).map((p) => Math.abs(p.value as number));
  const reach = Math.max(1, ...sized);
  const size = (p: { value: number | null }) =>
    p.value === null ? 7 : Math.max(4, Math.sqrt(Math.abs(p.value) / reach) * 28);
  return {
    ...base,
    tooltip: {
      ...(base.tooltip as AnyRecord),
      trigger: "item",
      formatter: (p: { name: string; value: number[] }) =>
        `${p.name}<br/>${p.value[1].toFixed(4)}, ${p.value[0].toFixed(4)}${p.value[2] == null ? "" : `<br/>${format(p.value[2])}`}`,
    },
    title: invalid
      ? { text: `${invalid} linha(s) sem coordenadas válidas`, left: 8, bottom: 2, textStyle: { color: theme.muted, fontSize: 10, fontWeight: "normal" } }
      : { show: false },
    geo: {
      map: geo.mapName,
      roam: true,
      scaleLimit: { min: 1, max: 20 },
      selectedMode: false,
      top: 8,
      bottom: 8,
      label: { show: false },
      silent: true,
      itemStyle: { areaColor: theme.dark ? "#1f2a2e" : "#eef2f2", borderColor: theme.stroke, borderWidth: 0.8 },
    },
    series: [
      {
        type: "scatter",
        coordinateSystem: "geo",
        symbolSize: (v: number[]) => size({ value: v[2] ?? null }),
        itemStyle: { color: palette[0], opacity: 0.65, borderColor: theme.stroke, borderWidth: 0.6 },
        label: { show: false },
        data: points.map((p) => ({
          name: p.name,
          value: [...p.coord, p.value],
          ...(selected && p.name !== selected ? { itemStyle: { opacity: DIM / 2 } } : {}),
        })),
      },
    ],
  };
};

/** Mapa coroplético (cor por região) ou de bolhas (círculo no centro da região); a malha vem pronta em `geo`. */
const buildMapOption = (
  { type, style, data, theme, palette, selected, geo }: BuildInput,
  base: AnyRecord,
  format: (value: unknown) => string,
): AnyRecord => {
  if (!geo) return { ...base, series: [] };
  if (type === "mappoints") return buildPointsOption({ type, style, data, theme, palette, selected, geo }, base, format);
  const first = data.series[0];
  const rows: { key: string; category: string; value: number }[] = [];
  const total = new Map<string, number>();
  let unmatched = 0;
  data.categories.forEach((category, index) => {
    const value = first?.values[index];
    if (value === null || value === undefined) return;
    const key = geo.resolve(category);
    if (!key) {
      unmatched += 1;
      return;
    }
    // várias linhas na mesma região somam
    total.set(key, (total.get(key) ?? 0) + value);
    if (!rows.some((row) => row.key === key)) rows.push({ key, category, value });
  });
  for (const row of rows) row.value = total.get(row.key) ?? row.value;

  const values = rows.map((row) => row.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const municipal = geo.scope === "municipio";
  const baseFill = theme.dark ? "#1f2a2e" : "#eef2f2";
  const hit = (key: string) => !selected || rows.find((row) => row.key === key)?.category === selected;
  const tooltip = {
    ...(base.tooltip as AnyRecord),
    trigger: "item",
    formatter: (p: { name: string; value: unknown }) => {
      const raw = Array.isArray(p.value) ? p.value[2] : p.value;
      return `${geo.label(p.name)}<br/>${raw == null || Number.isNaN(raw) ? "sem dados" : format(raw)}`;
    },
  };
  const notice = unmatched
    ? {
        text: `${unmatched} valor(es) sem região correspondente`,
        left: 8,
        bottom: 2,
        textStyle: { color: theme.muted, fontSize: 10, fontWeight: "normal" },
      }
    : { show: false };
  const label = { show: style.showLabels ?? !municipal, color: theme.text, fontSize: 10 };
  const regions = {
    map: geo.mapName,
    roam: municipal,
    scaleLimit: { min: 1, max: 14 },
    selectedMode: false,
    itemStyle: { areaColor: baseFill, borderColor: theme.stroke, borderWidth: municipal ? 0.3 : 0.8 },
    emphasis: { label, itemStyle: { areaColor: palette[1] ?? palette[0] } },
  };

  const range = {
    min,
    max: max === min ? min + 1 : max,
    calculable: false,
    orient: "horizontal",
    left: "center",
    bottom: 0,
    itemWidth: 12,
    itemHeight: 120,
    textStyle: { color: theme.muted, fontSize: 10 },
    formatter: (v: number) => formatNumber(v, "compacto", 0),
  };

  if (type === "map") {
    return {
      ...base,
      tooltip,
      title: notice,
      visualMap: { ...range, inRange: { color: [theme.dark ? "#24413f" : "#d9eeeb", palette[0]] } },
      series: [
        {
          type: "map",
          ...regions,
          showLegendSymbol: false,
          nameProperty: "name",
          top: 8,
          bottom: 40,
          label: { ...label, formatter: (p: { name: string }) => p.name },
          data: rows.map((row) => ({ name: row.key, value: row.value, ...(hit(row.key) ? {} : { itemStyle: { opacity: DIM } }) })),
        },
      ],
    };
  }

  const reach = Math.max(Math.abs(max), Math.abs(min), 1);
  const biggest = municipal ? 22 : 44;
  return {
    ...base,
    tooltip,
    title: notice,
    geo: { ...regions, top: 8, bottom: 8, label: { show: false } },
    series: [
      {
        type: "scatter",
        coordinateSystem: "geo",
        symbolSize: (value: number[]) => Math.max(4, Math.sqrt(Math.abs(value[2]) / reach) * biggest),
        itemStyle: { color: palette[0], opacity: 0.7, borderColor: theme.stroke, borderWidth: 1 },
        label: {
          show: Boolean(style.showLabels),
          position: "inside",
          color: "#fff",
          fontSize: 10,
          formatter: (p: { value: number[] }) => formatNumber(p.value[2], "compacto", 0),
        },
        data: rows.flatMap((row) => {
          const center = geo.center(row.key);
          return center ? [{ name: row.key, value: [...center, row.value], ...(hit(row.key) ? {} : { itemStyle: { opacity: DIM / 2 } }) }] : [];
        }),
      },
    ],
  };
};

export const buildChartOption = ({ type, style, data, theme, palette, selected, geo }: BuildInput): EChartsCoreOption => {
  /** Valor de um ponto, esmaecido quando não é a categoria selecionada. */
  const dim = (value: unknown, category: string) =>
    selected && category !== selected ? { value, itemStyle: { opacity: DIM } } : value;
  const percent = style.stack === "percent" && ["bar", "hbar", "area", "line", "combo"].includes(type);
  const format = (value: unknown): string => {
    const n = Number(value);
    if (value == null || !Number.isFinite(n)) return "—";
    if (percent) return `${formatNumber(n, "numero", 1)}%`;
    return `${style.prefix ?? ""}${formatNumber(n, style.valueFormat ?? "numero", style.decimals ?? 1)}${style.suffix ?? ""}`;
  };

  // empilhado a 100%: cada categoria vira porcentagem do seu total
  const series = percent
    ? data.series.map((s) => ({
        ...s,
        values: s.values.map((value, index) => {
          const total = data.series.reduce((sum, other) => sum + (other.values[index] ?? 0), 0);
          return value === null || total === 0 ? null : (value / total) * 100;
        }),
      }))
    : data.series;

  const legendMode = style.legend ?? "auto";
  const showLegend =
    legendMode === "none"
      ? false
      : legendMode === "auto"
        ? ["pie", "donut", "funnel", "treemap"].includes(type)
          ? type !== "treemap"
          : series.length > 1 && !["gauge", "heatmap", "map", "mapbubbles", "mappoints"].includes(type)
        : true;
  const legendPos = legendMode === "auto" || legendMode === "none" ? "top" : legendMode;
  const vertical = legendPos === "left" || legendPos === "right";

  const base: AnyRecord = {
    color: palette,
    backgroundColor: "transparent",
    animationDuration: 450,
    textStyle: { color: theme.muted, fontFamily: "inherit" },
    legend: showLegend
      ? {
          type: "scroll",
          [legendPos]: 0,
          ...(vertical ? { orient: "vertical", top: "middle" } : {}),
          icon: "roundRect",
          itemWidth: 10,
          itemHeight: 10,
          textStyle: { color: theme.muted, fontSize: 11 },
          pageIconColor: theme.muted,
          pageTextStyle: { color: theme.muted },
        }
      : { show: false },
    tooltip:
      style.showTooltip === false
        ? { show: false }
        : {
            confine: true,
            appendToBody: false,
            backgroundColor: theme.tooltipBg,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            padding: [8, 10],
            textStyle: { color: theme.text, fontSize: 12 },
            extraCssText: "border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25);",
            valueFormatter: format,
          },
  };

  const gridTop = showLegend && legendPos === "top" ? 34 : 12;
  const gridBottom = (showLegend && legendPos === "bottom" ? 30 : 6) + (style.zoom ? 30 : 0);
  const gridLeft = showLegend && legendPos === "left" ? 90 : 8;
  const gridRight = showLegend && legendPos === "right" ? 90 : 16;

  let option: AnyRecord;

  if (isCartesian(type)) {
    const horizontal = type === "hbar";
    const scatter = type === "scatter";
    const numericX = scatter && data.categories.every((c) => c !== "" && Number.isFinite(Number(c)));

    const categoryAxis: AnyRecord = {
      type: numericX ? "value" : "category",
      ...(numericX ? {} : { data: data.categories, boundaryGap: type === "bar" || type === "hbar" || type === "combo" }),
      name: horizontal ? style.yTitle : style.xTitle,
      nameLocation: "middle",
      nameGap: horizontal ? 44 : 28,
      nameTextStyle: { color: theme.muted, fontSize: 11 },
      show: !(horizontal ? style.hideYAxis : style.hideXAxis),
      axisLine: { lineStyle: { color: theme.axisLine } },
      axisTick: { show: false },
      axisLabel: {
        color: theme.muted,
        fontSize: 11,
        hideOverlap: true,
        ...(style.rotateLabels ? { rotate: style.rotateLabels } : {}),
        ...(horizontal ? { width: 90, overflow: "truncate" } : {}),
      },
      ...(horizontal ? { inverse: true } : {}),
      splitLine: { show: false },
    };
    const valueAxis: AnyRecord = {
      type: "value",
      name: horizontal ? style.xTitle : style.yTitle,
      nameLocation: "middle",
      nameGap: horizontal ? 28 : 44,
      nameTextStyle: { color: theme.muted, fontSize: 11 },
      show: !(horizontal ? style.hideXAxis : style.hideYAxis),
      min: percent ? 0 : style.yMin,
      max: percent ? 100 : style.yMax,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: theme.muted,
        fontSize: 11,
        formatter: (value: number) =>
          percent ? `${value}%` : formatNumber(value, style.valueFormat === "moeda" ? "compacto" : (style.valueFormat ?? "compacto"), 1),
      },
      splitLine: { show: style.showGrid !== false, lineStyle: { color: theme.grid, type: "dashed" } },
    };

    const stackName = style.stack && style.stack !== "none" ? "total" : undefined;
    const radius = style.barRadius ?? 4;

    option = {
      ...base,
      grid: { top: gridTop, bottom: gridBottom, left: gridLeft, right: gridRight, containLabel: true },
      xAxis: horizontal ? valueAxis : categoryAxis,
      yAxis: horizontal ? categoryAxis : valueAxis,
      tooltip: {
        ...(base.tooltip as AnyRecord),
        trigger: scatter ? "item" : "axis",
        ...(scatter
          ? {
              formatter: (p: { seriesName?: string; value?: unknown[] }) =>
                `${p.seriesName ?? ""}<br/>${p.value?.[0] ?? ""} · ${format(p.value?.[1])}`,
            }
          : { axisPointer: { type: type === "bar" || type === "hbar" ? "shadow" : "line", label: { show: false } } }),
      },
      ...(style.zoom
        ? {
            dataZoom: [
              { type: "inside", ...(horizontal ? { yAxisIndex: 0 } : { xAxisIndex: 0 }) },
              {
                type: "slider",
                height: 16,
                bottom: showLegend && legendPos === "bottom" ? 30 : 4,
                borderColor: "transparent",
                textStyle: { color: theme.muted },
                ...(horizontal ? { yAxisIndex: 0, width: 16, right: 0, height: undefined, bottom: undefined } : { xAxisIndex: 0 }),
              },
            ],
          }
        : {}),
      series: series.map((s, index) => {
        const kind = type === "combo" ? (index === 0 ? "bar" : "line") : type === "hbar" ? "bar" : type === "area" ? "line" : type;
        const isLine = kind === "line";
        const isBar = kind === "bar";
        const color = palette[index % palette.length];
        const stackable = isBar || type === "area" || (isLine && type !== "combo");
        return {
          name: s.name,
          type: kind,
          data:
            scatter && numericX
              ? s.values.map((v, i) => [Number(data.categories[i]), v])
              : isBar
                ? s.values.map((v, i) => dim(v, data.categories[i]))
                : s.values,
          ...(stackable && stackName ? { stack: stackName } : {}),
          itemStyle: {
            color,
            ...(isBar ? { borderRadius: horizontal ? [0, radius, radius, 0] : [radius, radius, 0, 0] } : {}),
          },
          ...(isBar ? { barMaxWidth: 64 } : {}),
          ...(isLine
            ? {
                smooth: style.smooth ?? false,
                showSymbol: style.showPoints ?? false,
                symbolSize: 6,
                lineStyle: { width: style.lineWidth ?? 2.25, color },
                ...(type === "area" ? { areaStyle: { color, opacity: style.areaOpacity ?? 0.18 } } : {}),
              }
            : {}),
          ...(scatter ? { symbolSize: 10 } : {}),
          emphasis: { focus: "series" },
          label: style.showLabels
            ? {
                show: true,
                position: isBar ? (stackName ? "inside" : horizontal ? "right" : "top") : "top",
                color: stackName && isBar ? "#fff" : theme.text,
                fontSize: 10,
                formatter: (p: { value: unknown }) => format(Array.isArray(p.value) ? p.value[1] : p.value),
              }
            : { show: false },
          ...(index === 0 && style.refLine !== undefined
            ? {
                markLine: {
                  silent: true,
                  symbol: "none",
                  lineStyle: { type: "dashed", color: theme.muted, width: 1.5 },
                  label: { formatter: style.refLabel || format(style.refLine), color: theme.muted, fontSize: 10 },
                  data: [horizontal ? { xAxis: style.refLine } : { yAxis: style.refLine }],
                },
              }
            : {}),
        };
      }),
    };
  } else if (type === "pie" || type === "donut") {
    const first = series[0];
    const points = data.categories.map((name, i) => ({
      name,
      value: first?.values[i] ?? 0,
      ...(selected && name !== selected ? { itemStyle: { opacity: DIM } } : {}),
    }));
    const inner = type === "donut" ? `${style.innerRadius ?? 55}%` : "0%";
    option = {
      ...base,
      tooltip: { ...(base.tooltip as AnyRecord), trigger: "item" },
      series: [
        {
          type: "pie",
          name: first?.name ?? "",
          radius: [inner, showLegend && legendPos === "bottom" ? "66%" : "76%"],
          center: ["50%", showLegend && legendPos === "bottom" ? "44%" : showLegend && legendPos === "top" ? "56%" : "50%"],
          data: points,
          itemStyle: { borderColor: theme.stroke, borderWidth: 2, borderRadius: type === "donut" ? 4 : 0 },
          label: {
            show: style.showLabels ?? points.length <= 6,
            color: theme.text,
            fontSize: 11,
            formatter: (p: { name: string; value: number; percent: number }) => `${p.name}: ${p.percent}%`,
          },
          labelLine: { lineStyle: { color: theme.axisLine } },
          emphasis: { scale: true, scaleSize: 6 },
        },
      ],
    };
  } else if (type === "funnel") {
    const first = series[0];
    const points = data.categories
      .map((name, i) => ({
        name,
        value: first?.values[i] ?? 0,
        ...(selected && name !== selected ? { itemStyle: { opacity: DIM } } : {}),
      }))
      .sort((a, b) => b.value - a.value);
    option = {
      ...base,
      tooltip: { ...(base.tooltip as AnyRecord), trigger: "item" },
      series: [
        {
          type: "funnel",
          name: first?.name ?? "",
          data: points,
          left: "8%",
          right: "8%",
          top: showLegend ? 34 : 12,
          bottom: 12,
          gap: 3,
          sort: "descending",
          itemStyle: { borderColor: theme.stroke, borderWidth: 1 },
          label: {
            show: style.showLabels ?? true,
            color: theme.text,
            fontSize: 11,
            formatter: (p: { name: string; value: number }) => `${p.name}: ${format(p.value)}`,
          },
        },
      ],
    };
  } else if (type === "treemap") {
    const first = series[0];
    option = {
      ...base,
      tooltip: { ...(base.tooltip as AnyRecord), trigger: "item" },
      series: [
        {
          type: "treemap",
          name: first?.name ?? "",
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          top: 6,
          bottom: 6,
          left: 6,
          right: 6,
          data: data.categories.map((name, i) => ({
            name,
            value: first?.values[i] ?? 0,
            ...(selected && name !== selected ? { itemStyle: { opacity: DIM } } : {}),
          })),
          itemStyle: { borderColor: theme.stroke, borderWidth: 2, gapWidth: 2 },
          label: {
            show: style.showLabels ?? true,
            color: "#fff",
            fontSize: 11,
            formatter: (p: { name: string; value: number }) => `${p.name}\n${format(p.value)}`,
          },
        },
      ],
    };
  } else if (type === "gauge") {
    const value = series[0]?.values.find((v) => v !== null) ?? 0;
    const max = style.gaugeMax ?? niceMax(value * 1.25);
    option = {
      ...base,
      tooltip: { ...(base.tooltip as AnyRecord), trigger: "item" },
      series: [
        {
          type: "gauge",
          name: series[0]?.name ?? "",
          min: style.yMin ?? 0,
          max,
          startAngle: 210,
          endAngle: -30,
          radius: "92%",
          progress: { show: true, width: 14, itemStyle: { color: palette[0] } },
          axisLine: { lineStyle: { width: 14, color: [[1, theme.grid]] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { color: theme.muted, fontSize: 10, distance: 18, formatter: (v: number) => formatNumber(v, "compacto", 0) },
          pointer: { show: false },
          anchor: { show: false },
          title: { show: true, offsetCenter: [0, "62%"], color: theme.muted, fontSize: 12 },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, "18%"],
            fontSize: 28,
            fontWeight: 600,
            color: theme.text,
            formatter: (v: number) => format(v),
          },
          data: [{ value, name: series[0]?.name ?? "" }],
        },
      ],
    };
  } else if (type === "radar") {
    const maxValue = Math.max(1, ...series.flatMap((s) => s.values.map((v) => v ?? 0)));
    option = {
      ...base,
      tooltip: { ...(base.tooltip as AnyRecord), trigger: "item" },
      radar: {
        indicator: data.categories.map((name) => ({ name, max: niceMax(maxValue * 1.1) })),
        radius: showLegend ? "62%" : "70%",
        center: ["50%", showLegend ? "56%" : "52%"],
        axisName: { color: theme.muted, fontSize: 11 },
        splitLine: { lineStyle: { color: theme.grid } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: theme.grid } },
      },
      series: [
        {
          type: "radar",
          data: series.map((s, index) => ({
            name: s.name,
            value: s.values.map((v) => v ?? 0),
            itemStyle: { color: palette[index % palette.length] },
            areaStyle: { opacity: style.areaOpacity ?? 0.15 },
            lineStyle: { width: style.lineWidth ?? 2 },
          })),
          label: { show: Boolean(style.showLabels), color: theme.text, fontSize: 10, formatter: (p: { value: number }) => format(p.value) },
        },
      ],
    };
  } else if (type === "map" || type === "mapbubbles" || type === "mappoints") {
    option = buildMapOption({ type, style, data, theme, palette, selected, geo }, base, format);
  } else {
    // heatmap: categorias no eixo X, séries no eixo Y
    const cells: [number, number, number | null][] = [];
    series.forEach((s, y) => s.values.forEach((v, x) => v !== null && cells.push([x, y, v])));
    const values = cells.map((c) => c[2] as number);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;
    option = {
      ...base,
      tooltip: {
        ...(base.tooltip as AnyRecord),
        trigger: "item",
        formatter: (p: { value: [number, number, number] }) =>
          `${series[p.value[1]]?.name ?? ""} · ${data.categories[p.value[0]] ?? ""}<br/>${format(p.value[2])}`,
      },
      grid: { top: 8, bottom: 52, left: 8, right: 16, containLabel: true },
      xAxis: {
        type: "category",
        data: data.categories,
        splitArea: { show: false },
        axisLine: { lineStyle: { color: theme.axisLine } },
        axisTick: { show: false },
        axisLabel: { color: theme.muted, fontSize: 11, hideOverlap: true, ...(style.rotateLabels ? { rotate: style.rotateLabels } : {}) },
      },
      yAxis: {
        type: "category",
        data: series.map((s) => s.name),
        inverse: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: theme.muted, fontSize: 11 },
      },
      visualMap: {
        min,
        max: max === min ? min + 1 : max,
        calculable: false,
        orient: "horizontal",
        left: "center",
        bottom: 0,
        itemWidth: 12,
        itemHeight: 120,
        textStyle: { color: theme.muted, fontSize: 10 },
        inRange: { color: [theme.dark ? "#1f2d30" : "#e6f2f1", palette[0]] },
      },
      series: [
        {
          type: "heatmap",
          data: cells,
          itemStyle: { borderColor: theme.stroke, borderWidth: 2, borderRadius: 3 },
          label: { show: Boolean(style.showLabels), color: theme.text, fontSize: 10, formatter: (p: { value: number[] }) => format(p.value[2]) },
          emphasis: { itemStyle: { borderColor: theme.text } },
        },
      ],
    };
  }

  const advanced = parseAdvanced(style.advanced);
  return (advanced ? deepMerge(option, advanced) : option) as EChartsCoreOption;
};
