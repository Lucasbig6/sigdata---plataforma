/**
 * Operações de layout puras sobre os elementos do painel: alinhar, distribuir,
 * igualar tamanho, organizar e guias de alinhamento (snap). Sem estado, para
 * poderem ser testadas e reaproveitadas pelo store.
 */
import {
  ELEMENT_MIN,
  clamp,
  clampPosition,
  type DashboardElement,
} from "@/lib/dashboards/types";

export type Box = { x: number; y: number; w: number; h: number };
export type Canvas = { width: number; height: number };

export type AlignMode = "left" | "center" | "right" | "top" | "middle" | "bottom";

export const boundsOf = (boxes: Box[]): Box => {
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
};

const place = (el: DashboardElement, x: number, y: number, canvas: Canvas): DashboardElement =>
  ({ ...el, ...clampPosition({ ...el, x, y }, canvas) }) as DashboardElement;

/** Alinha os elementos entre si (2+) ou à página (1). */
export const alignElements = (
  elements: DashboardElement[],
  ids: string[],
  mode: AlignMode,
  canvas: Canvas,
): DashboardElement[] => {
  const picked = elements.filter((el) => ids.includes(el.id));
  if (picked.length === 0) return elements;
  const ref: Box = picked.length === 1 ? { x: 0, y: 0, w: canvas.width, h: canvas.height } : boundsOf(picked);
  return elements.map((el) => {
    if (!ids.includes(el.id)) return el;
    switch (mode) {
      case "left":
        return place(el, ref.x, el.y, canvas);
      case "center":
        return place(el, ref.x + (ref.w - el.w) / 2, el.y, canvas);
      case "right":
        return place(el, ref.x + ref.w - el.w, el.y, canvas);
      case "top":
        return place(el, el.x, ref.y, canvas);
      case "middle":
        return place(el, el.x, ref.y + (ref.h - el.h) / 2, canvas);
      case "bottom":
        return place(el, el.x, ref.y + ref.h - el.h, canvas);
    }
  });
};

/** Espaçamento igual entre 3+ elementos, mantendo os dois extremos. */
export const distributeElements = (
  elements: DashboardElement[],
  ids: string[],
  axis: "horizontal" | "vertical",
  canvas: Canvas,
): DashboardElement[] => {
  const picked = elements.filter((el) => ids.includes(el.id));
  if (picked.length < 3) return elements;
  const horizontal = axis === "horizontal";
  const sorted = [...picked].sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const start = horizontal ? first.x : first.y;
  const end = horizontal ? last.x + last.w : last.y + last.h;
  const total = sorted.reduce((sum, el) => sum + (horizontal ? el.w : el.h), 0);
  const gap = (end - start - total) / (sorted.length - 1);

  const positions = new Map<string, number>();
  let cursor = start;
  for (const el of sorted) {
    positions.set(el.id, cursor);
    cursor += (horizontal ? el.w : el.h) + gap;
  }
  return elements.map((el) => {
    const pos = positions.get(el.id);
    if (pos === undefined) return el;
    return horizontal ? place(el, pos, el.y, canvas) : place(el, el.x, pos, canvas);
  });
};

/** Iguala largura ou altura ao maior dos selecionados (respeitando mínimo e página). */
export const matchSize = (
  elements: DashboardElement[],
  ids: string[],
  dimension: "w" | "h",
  canvas: Canvas,
): DashboardElement[] => {
  const picked = elements.filter((el) => ids.includes(el.id));
  if (picked.length < 2) return elements;
  const target = Math.max(...picked.map((el) => el[dimension]));
  return elements.map((el) => {
    if (!ids.includes(el.id)) return el;
    const min = ELEMENT_MIN[el.type];
    const limit = dimension === "w" ? canvas.width : canvas.height;
    const value = clamp(target, dimension === "w" ? min.w : min.h, limit);
    return place({ ...el, [dimension]: value } as DashboardElement, el.x, el.y, canvas);
  });
};

const GAP = 16;
const MARGIN = 24;

/**
 * Organiza em linhas, da esquerda para a direita e de cima para baixo, na ordem
 * atual de leitura. Os tamanhos são mantidos; a página cresce se faltar altura.
 */
export const autoArrange = (
  elements: DashboardElement[],
  canvas: Canvas,
): { elements: DashboardElement[]; height: number } => {
  const visible = elements.filter((el) => !el.hidden);
  const ordered = [...visible].sort((a, b) => a.y - b.y || a.x - b.x);
  const usable = canvas.width - MARGIN * 2;
  const positions = new Map<string, { x: number; y: number }>();

  let x = MARGIN;
  let y = MARGIN;
  let rowHeight = 0;
  for (const el of ordered) {
    const w = Math.min(el.w, usable);
    if (x > MARGIN && x + w > canvas.width - MARGIN) {
      x = MARGIN;
      y += rowHeight + GAP;
      rowHeight = 0;
    }
    positions.set(el.id, { x, y });
    x += w + GAP;
    rowHeight = Math.max(rowHeight, el.h);
  }
  const height = Math.max(canvas.height, y + rowHeight + MARGIN);
  const next = elements.map((el) => {
    const pos = positions.get(el.id);
    if (!pos) return el;
    const w = Math.min(el.w, usable);
    return { ...el, w, x: pos.x, y: pos.y } as DashboardElement;
  });
  return { elements: next, height };
};

/* ------------------------------------------------------------ guias (snap) */

export type Guides = { x: number[]; y: number[] };

export const NO_GUIDES: Guides = { x: [], y: [] };

const closest = (candidates: number[], targets: number[], threshold: number) => {
  let best: { delta: number; abs: number } | null = null;
  for (const c of candidates) {
    for (const t of targets) {
      const delta = t - c;
      const abs = Math.abs(delta);
      if (abs <= threshold && (!best || abs < best.abs)) best = { delta, abs };
    }
  }
  return best?.delta ?? 0;
};

const edgesX = (b: Box) => [b.x, b.x + b.w / 2, b.x + b.w];
const edgesY = (b: Box) => [b.y, b.y + b.h / 2, b.y + b.h];

/**
 * Ajusta o movimento de `moving` para alinhar bordas e centros com os outros
 * elementos e com a página. Devolve o deslocamento extra e as linhas guia.
 */
export const snapMove = (
  moving: Box,
  others: Box[],
  canvas: Canvas,
  threshold: number,
): { dx: number; dy: number; guides: Guides } => {
  const page: Box = { x: 0, y: 0, w: canvas.width, h: canvas.height };
  const targets = [page, ...others];
  const targetX = targets.flatMap(edgesX);
  const targetY = targets.flatMap(edgesY);

  const dx = closest(edgesX(moving), targetX, threshold);
  const dy = closest(edgesY(moving), targetY, threshold);
  const snapped: Box = { ...moving, x: moving.x + dx, y: moving.y + dy };

  const hit = (values: number[], list: number[]) =>
    [...new Set(list.filter((t) => values.some((v) => Math.abs(v - t) < 0.5)))].map((n) => Math.round(n * 10) / 10);
  return {
    dx,
    dy,
    guides: {
      x: dx !== 0 || targetX.some((t) => edgesX(snapped).some((v) => Math.abs(v - t) < 0.5))
        ? hit(edgesX(snapped), targetX)
        : [],
      y: dy !== 0 || targetY.some((t) => edgesY(snapped).some((v) => Math.abs(v - t) < 0.5))
        ? hit(edgesY(snapped), targetY)
        : [],
    },
  };
};
