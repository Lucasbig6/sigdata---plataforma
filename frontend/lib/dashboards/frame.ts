/**
 * Moldura dos elementos de dados: converte o `FrameStyle` salvo em CSS.
 * Sem configuração, o elemento ganha uma borda visível e fundo de cartão,
 * para ficar delimitado sobre qualquer fundo de página.
 */
import type { CSSProperties } from "react";
import type { FrameStyle } from "@/lib/dashboards/types";

export const FRAME_DEFAULTS = {
  borderWidth: 1,
  radius: 12,
  borderStyle: "solid",
  shadow: "none",
} as const;

/** Contorno padrão: legível nos temas claro e escuro. */
export const DEFAULT_BORDER_COLOR = "color-mix(in oklch, var(--foreground) 24%, transparent)";
export const DEFAULT_BACKGROUND = "var(--card)";

const SHADOWS = {
  none: "none",
  sm: "0 1px 3px rgb(0 0 0 / 0.14)",
  md: "0 4px 14px rgb(0 0 0 / 0.18)",
  lg: "0 12px 34px rgb(0 0 0 / 0.26)",
} as const;

export const frameCss = (frame: FrameStyle | undefined, defaultPadding = 0): CSSProperties => {
  const f = frame ?? {};
  const radius = f.radius ?? FRAME_DEFAULTS.radius;
  const padding = f.padding ?? defaultPadding;
  if (f.enabled === false) {
    return { border: "none", borderRadius: radius, background: "transparent", boxShadow: "none", padding };
  }
  const width = f.borderWidth ?? FRAME_DEFAULTS.borderWidth;
  return {
    border: width > 0 ? `${width}px ${f.borderStyle ?? FRAME_DEFAULTS.borderStyle} ${f.borderColor ?? DEFAULT_BORDER_COLOR}` : "none",
    borderRadius: radius,
    background: f.background ?? DEFAULT_BACKGROUND,
    boxShadow: SHADOWS[f.shadow ?? FRAME_DEFAULTS.shadow],
    padding,
  };
};
