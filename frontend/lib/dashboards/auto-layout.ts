/**
 * Arrumação automática de uma página: títulos e textos no topo, filtros numa linha, indicadores
 * lado a lado e o resto (gráficos, tabelas, visuais HTML) numa grade de duas colunas.
 * Formas, divisores e imagens são decorativos e ficam onde estão.
 */
import { ELEMENT_MIN, ELEMENT_SIZES, type DashboardElement } from "./types";

export type Placement = { x: number; y: number; w: number; h: number };

const MARGIN = 24;
const GAP = 16;
const KPI_MAX_PER_ROW = 5;

const KINDS = {
  heading: new Set(["title", "text"]),
  filter: new Set(["filter"]),
  indicator: new Set(["kpi", "percent", "comparison"]),
  skipped: new Set(["shape", "divider", "image"]),
};

const clampTo = (value: number, min: number) => Math.max(min, Math.round(value));

/** Posições novas (por id) e a altura que o conteúdo ocupa, para quem quiser ampliar a página. */
export const arrangeElements = (
  elements: DashboardElement[],
  canvas: { width: number; height: number },
): { placements: Map<string, Placement>; contentHeight: number } => {
  const placements = new Map<string, Placement>();
  const movable = elements.filter((el) => !el.hidden && !KINDS.skipped.has(el.type));
  const width = Math.max(canvas.width - MARGIN * 2, 200);
  let y = MARGIN;

  const place = (el: DashboardElement, x: number, top: number, w: number, h: number) => {
    const min = ELEMENT_MIN[el.type];
    placements.set(el.id, { x, y: top, w: clampTo(w, min.w), h: clampTo(h, min.h) });
  };

  // 1) títulos e textos ocupam a largura toda, na ordem em que estão na página
  for (const el of movable.filter((entry) => KINDS.heading.has(entry.type)).sort((a, b) => a.y - b.y || a.x - b.x)) {
    place(el, MARGIN, y, width, el.h);
    y += placements.get(el.id)!.h + GAP;
  }

  // 2) filtros lado a lado, quebrando de linha quando não cabem
  const filters = movable.filter((entry) => KINDS.filter.has(entry.type)).sort((a, b) => a.x - b.x);
  let x = MARGIN;
  let rowHeight = 0;
  for (const el of filters) {
    if (x > MARGIN && x + el.w > MARGIN + width) {
      x = MARGIN;
      y += rowHeight + GAP;
      rowHeight = 0;
    }
    place(el, x, y, el.w, el.h);
    x += placements.get(el.id)!.w + GAP;
    rowHeight = Math.max(rowHeight, placements.get(el.id)!.h);
  }
  if (filters.length > 0) y += rowHeight + GAP;

  // 3) indicadores dividem a largura em partes iguais
  const indicators = movable.filter((entry) => KINDS.indicator.has(entry.type)).sort((a, b) => a.y - b.y || a.x - b.x);
  for (let start = 0; start < indicators.length; start += KPI_MAX_PER_ROW) {
    const row = indicators.slice(start, start + KPI_MAX_PER_ROW);
    const cell = (width - GAP * (row.length - 1)) / row.length;
    const height = Math.max(...row.map((el) => ELEMENT_SIZES[el.type as "kpi"].h));
    row.forEach((el, index) => place(el, MARGIN + index * (cell + GAP), y, cell, height));
    y += height + GAP;
  }

  // 4) o resto numa grade de duas colunas (sozinho na linha, ocupa a largura toda)
  const rest = movable
    .filter((entry) => !KINDS.heading.has(entry.type) && !KINDS.filter.has(entry.type) && !KINDS.indicator.has(entry.type))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const cell = (width - GAP) / 2;
  for (let start = 0; start < rest.length; start += 2) {
    const row = rest.slice(start, start + 2);
    const height = Math.max(...row.map((el) => ELEMENT_SIZES[el.type].h));
    if (row.length === 1) place(row[0]!, MARGIN, y, width, height);
    else row.forEach((el, index) => place(el, MARGIN + index * (cell + GAP), y, cell, height));
    y += height + GAP;
  }

  return { placements, contentHeight: y - GAP + MARGIN };
};
