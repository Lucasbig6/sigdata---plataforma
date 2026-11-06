/**
 * Motor da grade (páginas com `canvas.layout === "grid"`): 12 colunas e linhas de GRID_ROW px.
 * Funções puras: encaixam cada elemento nas células, empurram para baixo quem colide e
 * compactam para cima (como o react-grid-layout), e montam a página automaticamente.
 * O modelo continua em px (x, y, w, h), sempre múltiplos da célula.
 */
import { ELEMENT_MIN, GRID_COLUMNS, GRID_ROW, type DashboardElement, type ElementType } from "../../../shared/dashboards/types.ts";

type Canvas = { width: number; height: number; layout?: "grid" };

/** Respiro abaixo do último elemento e altura mínima da página em grade. */
const BOTTOM_ROWS = 2;
const MIN_ROWS = 30;

export const isGrid = (canvas: { layout?: string } | undefined): boolean => canvas?.layout === "grid";

export const columnWidth = (canvas: Canvas) => canvas.width / GRID_COLUMNS;

/** Tamanho inicial por tipo, em células (colunas × linhas). */
const SPANS: Record<ElementType, { cols: number; rows: number }> = {
  chart: { cols: 6, rows: 16 },
  table: { cols: 12, rows: 15 },
  kpi: { cols: 3, rows: 6 },
  percent: { cols: 3, rows: 6 },
  comparison: { cols: 3, rows: 6 },
  text: { cols: 6, rows: 5 },
  title: { cols: 12, rows: 4 },
  image: { cols: 4, rows: 11 },
  divider: { cols: 12, rows: 2 },
  shape: { cols: 4, rows: 8 },
  filter: { cols: 3, rows: 5 },
  html: { cols: 6, rows: 16 },
};

export const gridSpan = (type: ElementType) => SPANS[type];

/** Tamanho em px de um elemento novo na grade. */
export const gridSize = (type: ElementType, canvas: Canvas) => {
  const span = SPANS[type];
  return { w: Math.round(span.cols * columnWidth(canvas)), h: span.rows * GRID_ROW };
};

type Cell = { id: string; gx: number; gy: number; gw: number; gh: number };

const overlaps = (a: Cell, b: Cell) =>
  a.gx < b.gx + b.gw && a.gx + a.gw > b.gx && a.gy < b.gy + b.gh && a.gy + a.gh > b.gy;

const toCell = (el: DashboardElement, canvas: Canvas): Cell => {
  const col = columnWidth(canvas);
  const min = ELEMENT_MIN[el.type];
  const minCols = Math.min(GRID_COLUMNS, Math.max(1, Math.ceil(min.w / col)));
  const minRows = Math.max(1, Math.ceil(min.h / GRID_ROW));
  const gw = Math.min(GRID_COLUMNS, Math.max(minCols, Math.round(el.w / col)));
  const gx = Math.min(GRID_COLUMNS - gw, Math.max(0, Math.round(el.x / col)));
  return {
    id: el.id,
    gx,
    gy: Math.max(0, Math.round(el.y / GRID_ROW)),
    gw,
    gh: Math.max(minRows, Math.round(el.h / GRID_ROW)),
  };
};

/**
 * Encaixa os elementos na grade. Os `pinned` (o que a pessoa está arrastando ou redimensionando)
 * ficam onde estão e os outros se acomodam em volta; sem `pinned` tudo é compactado para cima.
 * Elementos ocultos não ocupam espaço. Devolve também a altura da página.
 */
export const normalizeGrid = (
  elements: DashboardElement[],
  canvas: Canvas,
  pinned: string[] = [],
): { elements: DashboardElement[]; height: number } => {
  const col = columnWidth(canvas);
  const visible = elements.filter((el) => !el.hidden);
  const cells = new Map(visible.map((el) => [el.id, toCell(el, canvas)]));
  const placed: Cell[] = [];

  for (const id of pinned) {
    const cell = cells.get(id);
    if (cell) placed.push(cell);
  }
  const rest = visible
    .filter((el) => !pinned.includes(el.id))
    .map((el) => cells.get(el.id)!)
    .sort((a, b) => a.gy - b.gy || a.gx - b.gx);

  for (const cell of rest) {
    // empurra para baixo enquanto colide, depois sobe até encostar
    let hit = placed.find((other) => overlaps(cell, other));
    while (hit) {
      cell.gy = hit.gy + hit.gh;
      hit = placed.find((other) => overlaps(cell, other));
    }
    while (cell.gy > 0) {
      cell.gy -= 1;
      if (placed.some((other) => overlaps(cell, other))) {
        cell.gy += 1;
        break;
      }
    }
    placed.push(cell);
  }

  const bottom = Math.max(0, ...placed.map((cell) => cell.gy + cell.gh));
  const out = elements.map((el) => {
    const cell = cells.get(el.id) ?? toCell(el, canvas);
    const x = Math.round(cell.gx * col);
    return {
      ...el,
      x,
      y: cell.gy * GRID_ROW,
      w: Math.round((cell.gx + cell.gw) * col) - x,
      h: cell.gh * GRID_ROW,
    } as DashboardElement;
  });
  return { elements: out, height: Math.max(MIN_ROWS, bottom + BOTTOM_ROWS) * GRID_ROW };
};

/** Primeira posição livre (em px) para um elemento novo, procurando a partir da última linha usada. */
export const findGridSlot = (
  size: { w: number; h: number },
  existing: DashboardElement[],
  canvas: Canvas,
): { x: number; y: number } => {
  const col = columnWidth(canvas);
  const visible = existing.filter((el) => !el.hidden).map((el) => toCell(el, canvas));
  const probe: Cell = {
    id: "",
    gx: 0,
    gy: 0,
    gw: Math.min(GRID_COLUMNS, Math.max(1, Math.round(size.w / col))),
    gh: Math.max(1, Math.round(size.h / GRID_ROW)),
  };
  const last = visible.at(-1);
  const startRow = last ? last.gy : 0;
  for (let gy = startRow; gy < startRow + 400; gy += 1) {
    for (let gx = 0; gx + probe.gw <= GRID_COLUMNS; gx += 1) {
      const candidate = { ...probe, gx, gy };
      if (!visible.some((other) => overlaps(candidate, other))) return { x: Math.round(gx * col), y: gy * GRID_ROW };
    }
  }
  const bottom = Math.max(0, ...visible.map((cell) => cell.gy + cell.gh));
  return { x: 0, y: bottom * GRID_ROW };
};

const ORDER = (a: DashboardElement, b: DashboardElement) => a.y - b.y || a.x - b.x;
const HEADINGS = new Set<ElementType>(["title", "text"]);
const INDICATORS = new Set<ElementType>(["kpi", "percent", "comparison"]);
const MAX_PER_ROW = 4;
/** Gráficos redondos ou de um valor só ficam bonitos em meia largura, mesmo sozinhos na linha. */
const COMPACT_CHARTS = new Set(["pie", "donut", "gauge", "radar", "funnel"]);
const isCompact = (el: DashboardElement) => el.type === "chart" && COMPACT_CHARTS.has((el.props as { chartType?: string }).chartType ?? "");

/**
 * Monta a página inteira: títulos e textos no topo, filtros numa linha, indicadores lado a lado
 * e o resto (gráficos, mapas, tabelas…) em duas colunas — o que está sozinho na linha ocupa tudo.
 */
export const autoGridLayout = (
  elements: DashboardElement[],
  canvas: Canvas,
): { elements: DashboardElement[]; height: number } => {
  const col = columnWidth(canvas);
  const visible = elements.filter((el) => !el.hidden).sort(ORDER);
  const cells = new Map<string, Cell>();
  let row = 0;

  const put = (el: DashboardElement, gx: number, gw: number, gh: number) =>
    cells.set(el.id, { id: el.id, gx, gy: row, gw, gh });

  const flow = (group: DashboardElement[], per: number, rowsOf: (el: DashboardElement) => number) => {
    for (let start = 0; start < group.length; start += per) {
      const line = group.slice(start, start + per);
      const gw = line.length === 1 && isCompact(line[0]) ? GRID_COLUMNS / 2 : GRID_COLUMNS / Math.max(line.length, 1);
      const gh = Math.max(...line.map(rowsOf));
      line.forEach((el, index) => put(el, Math.round(index * gw), Math.round((index + 1) * gw) - Math.round(index * gw), gh));
      row += gh;
    }
  };

  for (const el of visible.filter((entry) => HEADINGS.has(entry.type))) {
    put(el, 0, GRID_COLUMNS, SPANS[el.type].rows);
    row += SPANS[el.type].rows;
  }

  // filtros e indicadores: até 4 por linha, dividindo a largura em partes iguais
  flow(visible.filter((entry) => entry.type === "filter"), MAX_PER_ROW, (el) => SPANS[el.type].rows);
  flow(visible.filter((entry) => INDICATORS.has(entry.type)), MAX_PER_ROW, (el) => SPANS[el.type].rows);

  // gráficos e afins: duas colunas; tabelas ocupam a linha toda
  const rest = visible.filter((entry) => !HEADINGS.has(entry.type) && entry.type !== "filter" && !INDICATORS.has(entry.type));
  let pending: DashboardElement[] = [];
  const flush = () => {
    flow(pending, 2, (el) => SPANS[el.type].rows);
    pending = [];
  };
  for (const el of rest) {
    if (el.type === "table" || el.type === "divider") {
      flush();
      put(el, 0, GRID_COLUMNS, SPANS[el.type].rows);
      row += SPANS[el.type].rows;
    } else pending.push(el);
  }
  flush();

  const out = elements.map((el) => {
    const cell = cells.get(el.id);
    if (!cell) return el;
    const x = Math.round(cell.gx * col);
    return { ...el, x, y: cell.gy * GRID_ROW, w: Math.round((cell.gx + cell.gw) * col) - x, h: cell.gh * GRID_ROW } as DashboardElement;
  });
  return { elements: out, height: Math.max(MIN_ROWS, row + BOTTOM_ROWS) * GRID_ROW };
};
