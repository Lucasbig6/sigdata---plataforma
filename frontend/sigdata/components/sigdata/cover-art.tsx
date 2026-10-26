import { cn } from "@/lib/utils";

/**
 * Ilustrações de pastas/arquivos por capa (0–7), em SVG sobre o gradiente.
 * Partes animadas usam as classes .sd-art-* definidas em globals.css.
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

/** Pasta com documentos saindo. */
const FOLDER_DOCS = (
  <g>
    <rect
      x="58"
      y="40"
      width="20"
      height="28"
      rx="2"
      fill="white"
      fillOpacity="0.08"
      stroke="white"
      strokeOpacity="0.22"
      strokeWidth="1"
      className="sd-art-float"
    />
    <rect
      x="82"
      y="34"
      width="20"
      height="34"
      rx="2"
      fill="white"
      fillOpacity="0.06"
      stroke="white"
      strokeOpacity="0.16"
      strokeWidth="1"
      className="sd-art-float-slow"
      style={{ animationDelay: "0.4s" }}
    />
    <path
      d="M48 50 h22 l6 8 h50 v40 h-78 z"
      fill="white"
      fillOpacity="0.07"
      stroke="white"
      strokeOpacity="0.28"
      strokeWidth="1.4"
      className="sd-art-draw"
    />
    <path
      d="M64 46 h10 M64 51 h12 M64 56 h8"
      {...STROKE}
      strokeOpacity="0.22"
      strokeWidth="1.1"
      className="sd-art-draw"
      style={{ animationDelay: "0.5s" }}
    />
    <circle cx="24" cy="28" r="5" fill="white" fillOpacity="0.16" className="sd-art-float-slow" />
  </g>
);

/** Pilha de pastas. */
const FOLDER_STACK = (
  <g>
    <path
      d="M42 58 h24 l7 8 h48 v34 h-79 z"
      fill="white"
      fillOpacity="0.04"
      stroke="white"
      strokeOpacity="0.12"
      strokeWidth="1.1"
      className="sd-art-float-slow"
    />
    <path
      d="M48 48 h24 l7 8 h48 v34 h-79 z"
      fill="white"
      fillOpacity="0.06"
      stroke="white"
      strokeOpacity="0.16"
      strokeWidth="1.2"
      className="sd-art-float"
      style={{ animationDelay: "0.3s" }}
    />
    <path
      d="M54 38 h24 l7 8 h48 v34 h-79 z"
      fill="white"
      fillOpacity="0.09"
      stroke="white"
      strokeOpacity="0.24"
      strokeWidth="1.3"
      className="sd-art-draw"
    />
    <circle cx="168" cy="24" r="6" fill="white" fillOpacity="0.18" className="sd-art-float" />
  </g>
);

/** Pasta com gráfico de barras. */
const FOLDER_CHART = (
  <g>
    <path
      d="M44 40 h26 l7 8 h52 v52 h-85 z"
      fill="white"
      fillOpacity="0.06"
      stroke="white"
      strokeOpacity="0.22"
      strokeWidth="1.3"
      className="sd-art-draw"
    />
    <rect
      x="62"
      y="68"
      width="10"
      height="18"
      rx="2"
      fill="white"
      fillOpacity="0.22"
      className="sd-art-float"
    />
    <rect
      x="78"
      y="58"
      width="10"
      height="28"
      rx="2"
      fill="white"
      fillOpacity="0.3"
      className="sd-art-float"
      style={{ animationDelay: "0.2s" }}
    />
    <rect
      x="94"
      y="64"
      width="10"
      height="22"
      rx="2"
      fill="white"
      fillOpacity="0.18"
      className="sd-art-float"
      style={{ animationDelay: "0.4s" }}
    />
    <path
      d="M30 24 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z"
      fill="white"
      fillOpacity="0.25"
      className="sd-art-float-slow"
    />
  </g>
);

/** Pasta aberta com arquivos voando. */
const FOLDER_OPEN = (
  <g>
    <g transform="rotate(-10 90 42)">
      <rect
        x="78"
        y="26"
        width="20"
        height="26"
        rx="2"
        fill="white"
        fillOpacity="0.07"
        stroke="white"
        strokeOpacity="0.18"
        strokeWidth="1"
        className="sd-art-float"
      />
    </g>
    <g transform="rotate(12 118 40)">
      <rect
        x="108"
        y="24"
        width="20"
        height="26"
        rx="2"
        fill="white"
        fillOpacity="0.05"
        stroke="white"
        strokeOpacity="0.14"
        strokeWidth="1"
        className="sd-art-float"
        style={{ animationDelay: "0.5s" }}
      />
    </g>
    <path
      d="M40 52 h18 l6 8 h40"
      {...STROKE}
      strokeOpacity="0.18"
      strokeWidth="1.3"
      className="sd-art-draw"
    />
    <path
      d="M42 60 h84 l-12 34 h-72 z"
      fill="white"
      fillOpacity="0.08"
      stroke="white"
      strokeOpacity="0.22"
      strokeWidth="1.3"
      className="sd-art-float-slow"
    />
    <circle cx="26" cy="30" r="5" fill="white" fillOpacity="0.14" className="sd-art-float-slow" />
  </g>
);

/** Pasta com etiqueta. */
const FOLDER_BADGE = (
  <g>
    <path
      d="M40 38 h28 l7 8 h54 v50 h-89 z"
      fill="white"
      fillOpacity="0.06"
      stroke="white"
      strokeOpacity="0.22"
      strokeWidth="1.3"
      className="sd-art-draw"
    />
    <rect
      x="56"
      y="60"
      width="30"
      height="12"
      rx="6"
      fill="white"
      fillOpacity="0.2"
      className="sd-art-float"
    />
    <rect
      x="56"
      y="78"
      width="20"
      height="8"
      rx="4"
      fill="white"
      fillOpacity="0.1"
      className="sd-art-float-slow"
    />
    <circle
      cx="168"
      cy="28"
      r="11"
      fill="white"
      fillOpacity="0.08"
      stroke="white"
      strokeOpacity="0.22"
      strokeWidth="1.2"
      className="sd-art-float-slow"
    />
    <path
      d="M168 22 v12 M162 28 h12"
      {...STROKE}
      strokeOpacity="0.28"
      strokeWidth="1.4"
      className="sd-art-float-slow"
    />
  </g>
);

/** Leque de pastas. */
const FOLDER_FAN = (
  <g>
    <g transform="rotate(16 130 88)">
      <path
        d="M70 40 h22 l6 8 h38 v44 h-66 z"
        fill="white"
        fillOpacity="0.04"
        stroke="white"
        strokeOpacity="0.12"
        strokeWidth="1"
        className="sd-art-float-slow"
      />
    </g>
    <g transform="rotate(8 125 86)">
      <path
        d="M64 40 h22 l6 8 h38 v44 h-66 z"
        fill="white"
        fillOpacity="0.06"
        stroke="white"
        strokeOpacity="0.15"
        strokeWidth="1.1"
        className="sd-art-float"
        style={{ animationDelay: "0.25s" }}
      />
    </g>
    <path
      d="M56 40 h22 l6 8 h38 v44 h-66 z"
      fill="white"
      fillOpacity="0.09"
      stroke="white"
      strokeOpacity="0.22"
      strokeWidth="1.2"
      className="sd-art-draw"
    />
    <circle cx="30" cy="88" r="14" fill="white" fillOpacity="0.05" className="sd-art-float-slow" />
  </g>
);

/** Pasta com lupa. */
const FOLDER_SEARCH = (
  <g>
    <path
      d="M38 36 h26 l7 8 h48 v52 h-81 z"
      fill="white"
      fillOpacity="0.06"
      stroke="white"
      strokeOpacity="0.2"
      strokeWidth="1.3"
      className="sd-art-draw"
    />
    <circle
      cx="148"
      cy="78"
      r="16"
      fill="white"
      fillOpacity="0.04"
      stroke="white"
      strokeOpacity="0.28"
      strokeWidth="2.2"
      className="sd-art-float"
    />
    <path
      d="M159 89 l12 12"
      {...STROKE}
      strokeOpacity="0.28"
      strokeWidth="2.8"
      className="sd-art-float"
    />
    <circle cx="28" cy="26" r="4" fill="white" fillOpacity="0.18" className="sd-art-float-slow" />
  </g>
);

/** Pasta com estrelas. */
const FOLDER_STARS = (
  <g>
    <path
      d="M46 42 h26 l7 8 h48 v48 h-81 z"
      fill="white"
      fillOpacity="0.07"
      stroke="white"
      strokeOpacity="0.22"
      strokeWidth="1.3"
      className="sd-art-draw"
    />
    <path
      d="M148 30 l2.4 6.2 6.2 2.4 -6.2 2.4 -2.4 6.2 -2.4 -6.2 -6.2 -2.4 6.2 -2.4 z"
      fill="white"
      fillOpacity="0.32"
      className="sd-art-float"
    />
    <path
      d="M128 18 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 z"
      fill="white"
      fillOpacity="0.2"
      className="sd-art-float-slow"
    />
    <circle
      cx="168"
      cy="58"
      r="3"
      fill="white"
      fillOpacity="0.22"
      className="sd-art-float"
      style={{ animationDelay: "0.6s" }}
    />
    <circle cx="26" cy="82" r="14" fill="white" fillOpacity="0.05" className="sd-art-float-slow" />
  </g>
);

const ARTS = [
  FOLDER_DOCS,
  FOLDER_STACK,
  FOLDER_CHART,
  FOLDER_OPEN,
  FOLDER_BADGE,
  FOLDER_FAN,
  FOLDER_SEARCH,
  FOLDER_STARS,
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
