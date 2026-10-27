"use client";

import { isDemoDataset, resolveTable } from "@/lib/dashboards/datasets";
import {
  filterValueOf,
  formatNumber,
  isBindingReady,
  toKpiValue,
  useBindingData,
  useDashboardData,
  useFilterOptions,
} from "@/lib/dashboards/live-data";
import { DataError, DataSkeleton, RefreshingDot } from "./data-state";
import type { ChartColor, DashboardElement } from "@/lib/dashboards/types";
import { useTheme } from "next-themes";
import { ChartView, useChartTheme } from "./charts";

/** Rótulos curtos de cada tipo (usados no editor e no painel de propriedades). */
export const ELEMENT_LABELS: Record<DashboardElement["type"], string> = {
  chart: "Gráfico",
  table: "Tabela",
  kpi: "KPI",
  percent: "Percentual",
  comparison: "Comparação",
  text: "Texto",
  title: "Título",
  image: "Imagem",
  divider: "Divisor",
  shape: "Forma",
  filter: "Filtro",
};

const nf = (value: number, digits = 1): string =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value);

const withAlpha = (color: string, alpha: number): string => color.replace(")", ` / ${alpha})`);

/** Tons semânticos (positivo / negativo / neutro) por tema. */
const LIGHT_TONES = {
  positive: "oklch(0.53 0.14 155)",
  negative: "oklch(0.55 0.16 25)",
  neutral: "oklch(0.5 0.02 250)",
};

const DARK_TONES = {
  positive: "oklch(0.72 0.17 155)",
  negative: "oklch(0.68 0.16 25)",
  neutral: "oklch(0.65 0.02 250)",
};

const useSemanticTones = () => {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? DARK_TONES : LIGHT_TONES;
};

/** Cores de texto gravadas nos dashboards que só existem no tema escuro. */
const LEGACY_DARK_TEXT = new Set(["#E8ECEF", "#9FB0B4"]);

const LIGHT_TEXT_DEFAULT = "oklch(0.28 0.045 250)";
const DARK_TEXT_DEFAULT = "oklch(0.96 0.005 250)";

const Panel = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/70 bg-panel/60 ${className}`}
  >
    {children}
  </div>
);

const ElementHeader = ({ title, showTitle }: { title: string; showTitle: boolean }) =>
  showTitle ? (
    <p className="shrink-0 truncate border-b border-border/60 px-4 py-2.5 text-xs font-medium text-foreground">
      {title}
    </p>
  ) : null;

const formatCell = (value: unknown) =>
  typeof value === "number" ? nf(value) : value == null ? "—" : String(value);

const TableElement = ({ element }: { element: DashboardElement & { type: "table" } }) => {
  const { title, showTitle, dataset, binding, density } = element.props;
  const live = useBindingData(element.id, binding);
  const isLive = isBindingReady(binding);
  const liveData = live.status === "ready" || live.status === "loading" ? live.data : undefined;
  const legacy = isLive ? null : resolveTable(dataset);
  const columns = liveData ? liveData.columns.map((c) => c.name) : (legacy?.columns ?? []);
  const rows = liveData ? liveData.rows : (legacy?.rows ?? []);
  const rowClass = density === "compacta" ? "px-4 py-1.5 text-[12px]" : "px-4 py-2.5 text-[13px]";

  const footer = isLive
    ? liveData
      ? `${rows.length} linha(s)${liveData.truncated ? " (limitado)" : ""}`
      : ""
    : isDemoDataset(dataset)
      ? "Dados de demonstração."
      : `${rows.length} linha(s) da análise salva.`;

  return (
    <Panel className="relative">
      <RefreshingDot state={live} />
      <ElementHeader title={title} showTitle={showTitle} />
      <div className="min-h-0 flex-1 overflow-auto">
        {isLive && !liveData ? (
          live.status === "error" ? (
            <DataError message={live.error} />
          ) : (
            <DataSkeleton />
          )
        ) : rows.length === 0 ? (
          <p className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Nenhuma linha para este recorte.
          </p>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-panel/95 backdrop-blur">
              <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {columns.map((column) => (
                  <th key={column} className="whitespace-nowrap px-4 py-2 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={index}
                  className="border-t border-border/50 text-foreground/90 transition-colors hover:bg-muted/40"
                >
                  {columns.map((column, colIndex) => (
                    <td
                      key={column}
                      className={`${rowClass} ${colIndex === 0 ? "font-medium" : ""} ${
                        typeof row[column] === "number" ? "tabular-nums" : ""
                      }`}
                    >
                      {formatCell(row[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {footer ? (
        <p className="shrink-0 border-t border-border/50 px-4 py-1.5 text-[10px] text-muted-foreground">
          {footer}
        </p>
      ) : null}
    </Panel>
  );
};

const DeltaBadge = ({ delta }: { delta: number }) => {
  const tones = useSemanticTones();
  const tone =
    delta > 0
      ? { color: tones.positive, glyph: "▲" }
      : delta < 0
        ? { color: tones.negative, glyph: "▼" }
        : { color: tones.neutral, glyph: "■" };
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums"
      style={{
        color: tone.color,
        background: withAlpha(tone.color, 0.14),
      }}
    >
      {tone.glyph} {delta > 0 ? "+" : ""}
      {nf(delta)}%
    </span>
  );
};

const IndicatorElement = ({
  element,
}: {
  element: DashboardElement & {
    type: "kpi" | "percent" | "comparison";
  };
}) => {
  const props = element.props;
  const live = useBindingData(element.id, props.binding);
  const isLive = isBindingReady(props.binding);
  const liveData = live.status === "ready" || live.status === "loading" ? live.data : undefined;
  const value =
    isLive && liveData && props.binding
      ? formatNumber(toKpiValue(props.binding, liveData), props.format, props.decimals ?? 1)
      : props.value;

  return (
    <Panel className="relative justify-between p-4">
      <RefreshingDot state={live} />
      <p className="truncate text-xs text-muted-foreground">{props.title}</p>
      {isLive && !liveData ? (
        live.status === "error" ? (
          <p className="line-clamp-2 text-[11px] text-destructive">{live.error}</p>
        ) : (
          <span className="h-8 w-24 animate-pulse rounded-md bg-muted" aria-label="Carregando" />
        )
      ) : (
        <div className="flex items-baseline gap-1.5">
          <span className="text-[30px] font-semibold leading-none tracking-tight text-foreground tabular-nums">
            {value}
          </span>
          {props.unit ? <span className="text-sm text-muted-foreground">{props.unit}</span> : null}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[11px] text-muted-foreground">{props.description}</p>
        {props.showDelta ? <DeltaBadge delta={props.delta} /> : null}
      </div>
    </Panel>
  );
};

const TextElement = ({ element }: { element: DashboardElement & { type: "text" | "title" } }) => {
  const { content, fontSize, bold, align, color } = element.props;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const resolvedColor = !color
    ? isDark
      ? DARK_TEXT_DEFAULT
      : LIGHT_TEXT_DEFAULT
    : !isDark && LEGACY_DARK_TEXT.has(color.toUpperCase())
      ? LIGHT_TEXT_DEFAULT
      : color;
  return (
    <div
      className="h-full w-full overflow-hidden whitespace-pre-wrap break-words"
      style={{
        fontSize: `${fontSize}px`,
        color: resolvedColor,
        textAlign: align,
        fontWeight: bold ? 600 : 400,
        lineHeight: element.type === "title" ? 1.15 : 1.55,
        letterSpacing: element.type === "title" ? "-0.015em" : undefined,
      }}
    >
      {content}
    </div>
  );
};

const ImageElement = ({ element }: { element: DashboardElement & { type: "image" } }) => {
  const { alt, variant, accent, fit, src } = element.props;
  if (src && /^https:\/\//i.test(src)) {
    return (
      // imagem externa definida pelo autor (next/image exigiria domínios fixos)
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="h-full w-full rounded-xl border border-border/70"
        style={{ objectFit: fit }}
      />
    );
  }
  return <ImageIllustration alt={alt} variant={variant} accent={accent} fit={fit} />;
};

const ImageIllustration = ({
  alt,
  variant,
  accent,
  fit,
}: {
  alt: string;
  variant: "gradiente" | "malha" | "ondas";
  accent: ChartColor;
  fit: "cover" | "contain";
}) => {
  const chartTheme = useChartTheme();
  const base = chartTheme.colors[accent] ?? chartTheme.colors[2];

  const background =
    variant === "gradiente"
      ? `linear-gradient(135deg, ${withAlpha(base, 0.55)} 0%, ${withAlpha(base, 0.12)} 55%, rgba(13, 18, 20, 0.9) 100%)`
      : variant === "malha"
        ? `repeating-linear-gradient(0deg, ${withAlpha(base, 0.22)} 0px, ${withAlpha(base, 0.22)} 1px, transparent 1px, transparent 24px), repeating-linear-gradient(90deg, ${withAlpha(base, 0.22)} 0px, ${withAlpha(base, 0.22)} 1px, transparent 1px, transparent 24px), radial-gradient(circle at 30% 30%, ${withAlpha(base, 0.35)}, rgba(13, 18, 20, 0.92))`
        : `radial-gradient(ellipse at 20% 20%, ${withAlpha(base, 0.45)}, transparent 55%), radial-gradient(ellipse at 80% 60%, ${withAlpha(base, 0.3)}, transparent 60%), radial-gradient(ellipse at 40% 90%, ${withAlpha(base, 0.22)}, transparent 50%), rgba(13, 18, 20, 0.9)`;

  return (
    <div
      role="img"
      aria-label={alt}
      className="relative h-full w-full overflow-hidden rounded-xl border border-border/70"
      style={{ background, backgroundSize: fit === "contain" ? "auto" : undefined }}
    >
      <span className="absolute bottom-2 left-3 text-[10px] text-foreground/70">{alt}</span>
    </div>
  );
};

const DividerElement = ({ element }: { element: DashboardElement & { type: "divider" } }) => (
  <div className="flex h-full w-full items-center">
    <div
      className="w-full"
      style={{
        borderTop: `${element.props.thickness}px ${element.props.style} ${element.props.color}`,
      }}
    />
  </div>
);

const ShapeElement = ({ element }: { element: DashboardElement & { type: "shape" } }) => {
  const { shape, fill, border, borderWidth, radius } = element.props;
  return (
    <div
      className="h-full w-full"
      style={{
        background: fill,
        border: `${borderWidth}px solid ${border}`,
        borderRadius: shape === "circulo" ? "50%" : `${radius}px`,
      }}
    />
  );
};

const FilterElement = ({ element }: { element: DashboardElement & { type: "filter" } }) => {
  const { label, options: staticOptions, binding } = element.props;
  const ctx = useDashboardData();
  const live = useFilterOptions(element);
  const value = filterValueOf(ctx, element);
  const options = binding ? (live.status === "ready" ? live.data.options : []) : staticOptions;

  return (
    <div className="no-drag flex h-full w-full flex-col justify-center gap-1 rounded-xl border border-border/70 bg-panel/60 px-3">
      <label className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="truncate">{label}</span>
        {binding && live.status === "loading" ? <span className="text-[10px]">carregando…</span> : null}
        {binding && live.status === "error" ? (
          <span className="truncate text-[10px] text-destructive" title={live.error}>
            erro
          </span>
        ) : null}
      </label>
      <select
        value={value}
        onChange={(event) => ctx.setValue(element.id, event.target.value)}
        className="w-full cursor-pointer truncate rounded-md bg-transparent text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        {binding ? <option value="">Todos</option> : null}
        {binding && value && !options.includes(value) ? <option value={value}>{value}</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
};

export const ElementView = ({ element }: { element: DashboardElement }) => {
  switch (element.type) {
    case "chart":
      return <ChartView element={element} />;
    case "table":
      return <TableElement element={element} />;
    case "kpi":
    case "percent":
    case "comparison":
      return <IndicatorElement element={element} />;
    case "text":
    case "title":
      return <TextElement element={element} />;
    case "image":
      return <ImageElement element={element} />;
    case "divider":
      return <DividerElement element={element} />;
    case "shape":
      return <ShapeElement element={element} />;
    case "filter":
      return <FilterElement element={element} />;
    default:
      return null;
  }
};
