import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";
import type { Kpi, Municipio, SeriesPoint } from "@/lib/demo-data";

const nf = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

const formatDelta = (delta: number) => `${delta > 0 ? "+" : ""}${nf.format(delta)}%`;

const useElementWidth = <T extends HTMLElement>(
  fallback: number,
): [RefObject<T | null>, number] => {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
};

export const ChartFrame = ({
  title,
  caption,
  children,
  className,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
  className?: string;
}) => (
  <section
    className={cn("bg-card border border-border rounded-xl p-4 flex flex-col gap-3", className)}
  >
    <header className="flex items-baseline justify-between gap-3">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {caption ? <span className="text-xs text-muted-foreground">{caption}</span> : null}
    </header>
    {children}
  </section>
);

const CHART_H = 180;
const CHART_FALLBACK_W = 360;
const PAD = { top: 10, right: 8, bottom: 26, left: 34 };

const niceMax = (value: number) => {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
};

const AxisGrid = ({ max, width, ticks = 4 }: { max: number; width: number; ticks?: number }) => {
  const innerH = CHART_H - PAD.top - PAD.bottom;
  return (
    <g>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const value = (max / ticks) * i;
        const y = PAD.top + innerH - (i / ticks) * innerH;
        return (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y}
              y2={y}
              className="stroke-border"
              strokeWidth={1}
              strokeDasharray={i === 0 ? undefined : "3 4"}
            />
            <text
              x={PAD.left - 6}
              y={y + 3}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize={9}
            >
              {Math.round(value)}
            </text>
          </g>
        );
      })}
    </g>
  );
};

export const BarChart = ({ data, className }: { data: SeriesPoint[]; className?: string }) => {
  const [ref, width] = useElementWidth<HTMLDivElement>(CHART_FALLBACK_W);
  const chartW = Math.max(Math.round(width), 200);
  const max = niceMax(Math.max(...data.map((d) => d.valor)));
  const innerW = chartW - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const barW = Math.min(28, slot * 0.6);

  return (
    <div ref={ref} className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${chartW} ${CHART_H}`}
        className="w-full"
        style={{ height: CHART_H }}
        role="img"
        aria-label="Gráfico de barras dos indicadores mensais"
      >
        <AxisGrid max={max} width={chartW} />
        {data.map((d, i) => {
          const h = (d.valor / max) * innerH;
          const x = PAD.left + slot * i + (slot - barW) / 2;
          const y = PAD.top + innerH - h;
          return (
            <g key={d.label}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, 1)}
                rx={3}
                className="fill-primary/85 hover:fill-primary transition-colors"
              />
              <text
                x={x + barW / 2}
                y={CHART_H - PAD.bottom + 14}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={9}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const LineChart = ({ data, className }: { data: SeriesPoint[]; className?: string }) => {
  const [ref, width] = useElementWidth<HTMLDivElement>(CHART_FALLBACK_W);
  const chartW = Math.max(Math.round(width), 200);
  const max = niceMax(Math.max(...data.map((d) => d.valor)));
  const innerW = chartW - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const step = innerW / Math.max(data.length - 1, 1);

  const points = data.map((d, i) => {
    const x = PAD.left + step * i;
    const y = PAD.top + innerH - (d.valor / max) * innerH;
    return { ...d, x, y };
  });

  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${PAD.left},${PAD.top + innerH} ${line} ${PAD.left + innerW},${PAD.top + innerH}`;

  return (
    <div ref={ref} className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${chartW} ${CHART_H}`}
        className="w-full"
        style={{ height: CHART_H }}
        role="img"
        aria-label="Gráfico de linha da série temporal"
      >
        <AxisGrid max={max} width={chartW} />
        <polygon points={area} className="fill-primary/10" />
        <polyline
          points={line}
          fill="none"
          className="stroke-primary"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r={2.6} className="fill-primary" />
            {(i === 0 || i === points.length - 1 || i % 3 === 0) && (
              <text
                x={p.x}
                y={CHART_H - PAD.bottom + 14}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={9}
              >
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};

export const KpiCard = ({ kpi }: { kpi: Kpi }) => {
  const positive = kpi.delta > 0;
  const neutral = kpi.delta === 0;
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{kpi.label}</span>
      <span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
        {kpi.value}
      </span>
      <div className="flex items-center gap-2 text-xs">
        <span
          className={cn(
            "tabular-nums font-medium",
            neutral ? "text-muted-foreground" : positive ? "text-primary" : "text-destructive",
          )}
        >
          {neutral ? "estável" : formatDelta(kpi.delta)}
        </span>
        <span className="text-muted-foreground truncate">{kpi.hint}</span>
      </div>
    </div>
  );
};

export const KpiGrid = ({ items }: { items: Kpi[] }) => (
  <div className="@container w-full">
    <div className="grid grid-cols-2 gap-3 @sm:grid-cols-3 @lg:grid-cols-4 @2xl:grid-cols-5">
      {items.map((kpi) => (
        <KpiCard key={kpi.label} kpi={kpi} />
      ))}
    </div>
  </div>
);

export const DataTable = ({ rows }: { rows: Municipio[] }) => (
  <div className="overflow-x-auto rounded-xl border border-border">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-muted/60 text-muted-foreground">
          <th className="text-left font-medium px-3 py-2.5">Município</th>
          <th className="text-right font-medium px-3 py-2.5">Índice</th>
          <th className="text-right font-medium px-3 py-2.5">Variação</th>
          <th className="text-right font-medium px-3 py-2.5">Receita (R$ mi)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr
            key={row.nome}
            className={cn(
              "border-t border-border transition-colors hover:bg-muted/50",
              index % 2 === 1 && "bg-muted/20",
            )}
          >
            <td className="px-3 py-2.5 text-foreground">{row.nome}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{nf.format(row.indice)}</td>
            <td
              className={cn(
                "px-3 py-2.5 text-right tabular-nums",
                row.variacao > 0
                  ? "text-primary"
                  : row.variacao < 0
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
            >
              {formatDelta(row.variacao)}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums">{nf.format(row.receita)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
