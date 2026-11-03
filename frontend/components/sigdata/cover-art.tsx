import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Ilustrações de pasta por capa (0–7), em SVG sobre o gradiente.
 * Uma pasta só (fundo com aba + aba frontal) e, no máximo, um detalhe por capa.
 * Movimento via classes .sd-art-* de globals.css.
 */
type CoverArtProps = {
  index: number;
  className?: string;
};

const STROKE = {
  fill: "none",
  stroke: "white",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
} as const;

/** Folha que espia por trás da pasta e sobe um pouco no hover. */
const Paper = ({ x, y = 34, tilt = 0, delay = 0 }: { x: number; y?: number; tilt?: number; delay?: number }) => (
  <g className="sd-art-lift">
    <rect
      x={x}
      y={y}
      width="34"
      height="44"
      rx="3"
      transform={`rotate(${tilt} ${x + 17} ${y + 44})`}
      fill="white"
      fillOpacity="0.1"
      stroke="white"
      strokeOpacity="0.3"
      strokeWidth="1.2"
      className="sd-art-float-slow"
      style={{ animationDelay: `${delay}s` }}
    />
  </g>
);

const Folder = ({ back, front }: { back?: ReactNode; front?: ReactNode }) => (
  <g>
    <path
      d="M44 38 h28 l8 9 h76 a4 4 0 0 1 4 4 v50 a4 4 0 0 1 -4 4 H44 a4 4 0 0 1 -4 -4 V42 a4 4 0 0 1 4 -4 z"
      fill="white"
      fillOpacity="0.1"
      stroke="white"
      strokeOpacity="0.3"
      strokeWidth="1.3"
      className="sd-art-draw"
    />
    {back}
    <path
      d="M40 58 a4 4 0 0 1 4 -4 h112 a4 4 0 0 1 4 4 v42 a4 4 0 0 1 -4 4 H44 a4 4 0 0 1 -4 -4 z"
      fill="white"
      fillOpacity="0.14"
      stroke="white"
      strokeOpacity="0.38"
      strokeWidth="1.3"
      className="sd-art-draw"
      style={{ animationDelay: "0.25s" }}
    />
    {front}
  </g>
);

const bars = (heights: number[]) => (
  <g>
    {heights.map((h, i) => (
      <rect key={i} x={60 + i * 16} y={96 - h} width="10" height={h} rx="2" fill="white" fillOpacity={0.2 + i * 0.07} className="sd-art-grow" style={{ animationDelay: `${i * 0.12}s` }} />
    ))}
  </g>
);

const ARTS: ReactNode[] = [
  // Um documento saindo
  <Folder key="docs" back={<Paper x={64} />} />,
  // Dois documentos
  <Folder key="two" back={<><Paper x={56} tilt={-6} /><Paper x={96} y={30} tilt={5} delay={0.5} /></>} />,
  // Barras na frente
  <Folder key="bars" front={bars([14, 24, 18, 30])} />,
  // Linha de tendência na frente
  <Folder key="line" front={<path d="M56 90 L80 78 L100 84 L128 66 L148 72" {...STROKE} strokeOpacity="0.45" strokeWidth="1.8" className="sd-art-draw" style={{ animationDelay: "0.5s" }} />} />,
  // Etiqueta
  <Folder key="tag" front={<rect x="56" y="72" width="40" height="12" rx="6" fill="white" fillOpacity="0.24" className="sd-art-float-slow" />} />,
  // Três documentos em leque
  <Folder key="fan" back={<><Paper x={54} tilt={-12} /><Paper x={83} y={30} delay={0.3} /><Paper x={112} tilt={12} delay={0.6} /></>} />,
  // Lupa
  <Folder
    key="search"
    front={
      <g className="sd-art-float-slow">
        <circle cx="112" cy="80" r="12" {...STROKE} strokeOpacity="0.45" strokeWidth="2" />
        <path d="M121 89 l9 9" {...STROKE} strokeOpacity="0.45" strokeWidth="2.4" />
      </g>
    }
  />,
  // Pasta lisa com documento
  <Folder key="plain" back={<Paper x={92} tilt={4} />} />,
];

export const CoverArt = ({ index, className }: CoverArtProps) => {
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
