/**
 * Layout para celular: gerado automaticamente a partir da página. Os elementos
 * viram uma coluna na ordem de leitura (de cima para baixo, da esquerda para a
 * direita); indicadores seguidos ficam lado a lado. Posições salvas não mudam.
 */
import type { DashboardElement } from "@/lib/dashboards/types";

export const MOBILE_WIDTH = 390;
const SIDE = 12;
const GAP = 12;

type View = { canvas: { width: number; height: number; background?: string; palette?: string[] }; elements: DashboardElement[] };

const isIndicator = (el: DashboardElement) => el.type === "kpi" || el.type === "percent" || el.type === "comparison";

/** Altura no celular: proporcional à largura nova, com limites por tipo. */
const heightFor = (el: DashboardElement, width: number): number => {
  const scaled = Math.round((el.h * width) / Math.max(el.w, 1));
  switch (el.type) {
    case "chart":
      return Math.min(Math.max(scaled, 240), 380);
    case "table":
      return Math.min(Math.max(scaled, 200), 420);
    case "image":
    case "shape":
      return Math.min(Math.max(scaled, 80), 300);
    case "text":
    case "title": {
      // texto mais estreito ocupa mais linhas: reserva espaço pela razão das larguras
      const ratio = el.w / width;
      return Math.max(el.h, Math.round(el.h * Math.max(ratio, 1)));
    }
    default:
      return el.h;
  }
};

export const toMobileLayout = (doc: View): View => {
  const visible = doc.elements.filter((el) => !el.hidden && !el.hideOnMobile);
  // elementos na mesma "linha" visual (y próximos) são lidos da esquerda para a direita
  const ordered = [...visible].sort((a, b) => (Math.abs(a.y - b.y) < 24 ? a.x - b.x : a.y - b.y));
  const full = MOBILE_WIDTH - SIDE * 2;
  const half = Math.floor((full - GAP) / 2);

  const placed: DashboardElement[] = [];
  let y = SIDE;
  for (let i = 0; i < ordered.length; i += 1) {
    const el = ordered[i];
    const next = ordered[i + 1];
    if (isIndicator(el) && next && isIndicator(next)) {
      const h = Math.max(el.h, next.h, 96);
      placed.push({ ...el, x: SIDE, y, w: half, h } as DashboardElement);
      placed.push({ ...next, x: SIDE + half + GAP, y, w: half, h } as DashboardElement);
      y += h + GAP;
      i += 1;
      continue;
    }
    const h = heightFor(el, full);
    placed.push({ ...el, x: SIDE, y, w: full, h } as DashboardElement);
    y += h + GAP;
  }

  return {
    canvas: { ...doc.canvas, width: MOBILE_WIDTH, height: Math.max(y + SIDE - GAP, 480) },
    elements: placed.map((el, index) => ({ ...el, z: index }) as DashboardElement),
  };
};
