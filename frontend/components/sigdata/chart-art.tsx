import { cn } from "@/lib/utils";

/**
 * Ilustrações de gráficos por capa (0–5), em SVG sobre o gradiente.
 * Mesma linguagem das pastas (cover-art.tsx): traços finos, formas translúcidas
 * e as classes .sd-art-* de globals.css para o movimento.
 */
type ChartArtProps = {
  index: number;
  className?: string;
};

const LINE = {
  fill: "none",
  stroke: "white",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
} as const;

const Axes = () => (
  <path d="M34 26 v70 h132" {...LINE} strokeOpacity="0.2" strokeWidth="1.2" className="sd-art-draw" />
);

const bar = (x: number, h: number, opacity: number, delay: number) => (
  <rect
    key={x}
    x={x}
    y={96 - h}
    width="14"
    height={h}
    rx="2.5"
    fill="white"
    fillOpacity={opacity}
    className="sd-art-grow"
    style={{ animationDelay: `${delay}s` }}
  />
);

/** Barras verticais. */
const CHART_BARS = (
  <g>
    <Axes />
    {bar(46, 26, 0.16, 0.1)}
    {bar(68, 44, 0.26, 0.2)}
    {bar(90, 34, 0.2, 0.3)}
    {bar(112, 56, 0.32, 0.4)}
    {bar(134, 42, 0.22, 0.5)}
    <circle cx="170" cy="26" r="5" fill="white" fillOpacity="0.18" className="sd-art-float-slow" />
  </g>
);

/** Linha de tendência com pontos. */
const CHART_LINE = (
  <g>
    <Axes />
    <path d="M40 80 L68 62 L92 70 L120 42 L158 30" {...LINE} strokeOpacity="0.4" strokeWidth="2" className="sd-art-draw" />
    {[
      [68, 62],
      [92, 70],
      [120, 42],
      [158, 30],
    ].map(([cx, cy], i) => (
      <circle key={cx} cx={cx} cy={cy} r="3.4" fill="white" fillOpacity="0.45" className="sd-art-float" style={{ animationDelay: `${i * 0.25}s` }} />
    ))}
    <circle cx="26" cy="22" r="4" fill="white" fillOpacity="0.16" className="sd-art-float-slow" />
  </g>
);

/** Rosca (pizza) com fatias. */
const CHART_DONUT = (
  <g>
    <circle cx="100" cy="60" r="30" {...LINE} strokeOpacity="0.14" strokeWidth="12" />
    <circle
      cx="100"
      cy="60"
      r="30"
      {...LINE}
      strokeOpacity="0.38"
      strokeWidth="12"
      strokeDasharray="188"
      strokeDashoffset="100"
      transform="rotate(-90 100 60)"
      className="sd-art-spin"
      style={{ transformOrigin: "100px 60px" }}
    />
    <circle cx="100" cy="60" r="30" {...LINE} strokeOpacity="0.22" strokeWidth="12" strokeDasharray="38 150" transform="rotate(100 100 60)" className="sd-art-draw" />
    <circle cx="160" cy="28" r="6" fill="white" fillOpacity="0.18" className="sd-art-float" />
    <circle cx="36" cy="94" r="10" fill="white" fillOpacity="0.06" className="sd-art-float-slow" />
  </g>
);

/** Área preenchida. */
const CHART_AREA = (
  <g>
    <Axes />
    <path d="M36 94 L36 74 L64 56 L92 66 L122 38 L162 48 L162 94 Z" fill="white" fillOpacity="0.12" className="sd-art-float-slow" />
    <path d="M36 74 L64 56 L92 66 L122 38 L162 48" {...LINE} strokeOpacity="0.42" strokeWidth="1.8" className="sd-art-draw" />
    <path d="M36 88 L64 78 L92 84 L122 66 L162 72" {...LINE} strokeOpacity="0.2" strokeWidth="1.2" className="sd-art-draw" style={{ animationDelay: "0.5s" }} />
    <path d="M168 18 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" fill="white" fillOpacity="0.25" className="sd-art-float" />
  </g>
);

/** Barras horizontais (ranking). */
const CHART_RANK = (
  <g>
    {[
      [58, 0.3],
      [44, 0.22],
      [30, 0.16],
      [18, 0.12],
    ].map(([w, o], i) => (
      <rect
        key={i}
        x="44"
        y={30 + i * 16}
        width={(w ?? 0) * 2.6}
        height="9"
        rx="4.5"
        fill="white"
        fillOpacity={o}
        className="sd-art-float"
        style={{ animationDelay: `${i * 0.2}s` }}
      />
    ))}
    <path d="M40 24 v64" {...LINE} strokeOpacity="0.2" strokeWidth="1.2" className="sd-art-draw" />
    <circle cx="168" cy="92" r="12" fill="white" fillOpacity="0.05" className="sd-art-float-slow" />
  </g>
);

/** Dispersão. */
const CHART_SCATTER = (
  <g>
    <Axes />
    {[
      [52, 78, 4],
      [66, 64, 3],
      [80, 72, 5],
      [96, 52, 4],
      [112, 56, 3],
      [128, 38, 5],
      [146, 44, 3],
      [100, 80, 3],
    ].map(([cx, cy, r], i) => (
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r={r}
        fill="white"
        fillOpacity={0.16 + (i % 3) * 0.08}
        className={i % 2 ? "sd-art-float-slow" : "sd-art-float"}
        style={{ animationDelay: `${i * 0.15}s` }}
      />
    ))}
    <path d="M44 86 L152 36" {...LINE} strokeOpacity="0.2" strokeWidth="1.2" strokeDasharray="4 4" className="sd-art-float-slow" />
  </g>
);

const ARTS = [CHART_BARS, CHART_LINE, CHART_DONUT, CHART_AREA, CHART_RANK, CHART_SCATTER];

export const ChartArt = ({ index, className }: ChartArtProps) => {
  const art = ARTS[Math.abs(index) % ARTS.length]!;
  return (
    <svg
      viewBox="0 0 200 120"
      preserveAspectRatio="xMidYMid slice"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      aria-hidden
    >
      {art}
    </svg>
  );
};
