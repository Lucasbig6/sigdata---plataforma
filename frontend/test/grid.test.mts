import assert from "node:assert/strict";
import { test } from "node:test";
import { autoGridLayout, findGridSlot, gridSize, normalizeGrid } from "../lib/dashboards/grid.ts";
import type { DashboardElement } from "../../shared/dashboards/types.ts";

const canvas = { width: 1200, height: 600, layout: "grid" as const };

const el = (id: string, type: DashboardElement["type"], x: number, y: number, w: number, h: number, hidden = false) =>
  ({ id, type, x, y, w, h, z: 0, hidden, props: {} }) as unknown as DashboardElement;

const overlapAny = (list: DashboardElement[]) =>
  list.some((a, i) => list.slice(i + 1).some((b) => !a.hidden && !b.hidden && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y));

test("encaixa nas células de 100 px × 20 px", () => {
  const out = normalizeGrid([el("a", "chart", 37, 13, 590, 330)], canvas).elements[0];
  assert.deepEqual([out.x, out.y, out.w, out.h], [0, 0, 600, 340]);
});

test("empurra quem colide e compacta os buracos", () => {
  const { elements } = normalizeGrid(
    [el("a", "chart", 0, 0, 600, 320), el("b", "chart", 0, 100, 600, 320), el("c", "chart", 600, 900, 600, 320)],
    canvas,
    ["b"],
  );
  assert.equal(overlapAny(elements), false);
  const byId = Object.fromEntries(elements.map((e) => [e.id, e]));
  assert.equal(byId.b.y, 100, "o arrastado fica onde foi solto");
  assert.equal(byId.a.y, 420, "quem estava no caminho vai para baixo do arrastado");
  assert.equal(byId.c.y, 0, "o que estava longe sobe");
});

test("sem pinned compacta para cima", () => {
  const { elements } = normalizeGrid([el("a", "chart", 0, 800, 600, 320)], canvas);
  assert.equal(elements[0].y, 0);
});

test("idempotente: rodar de novo não muda nada", () => {
  const first = normalizeGrid([el("a", "kpi", 0, 0, 300, 120), el("b", "chart", 0, 120, 700, 330), el("c", "table", 0, 500, 1200, 300)], canvas);
  const second = normalizeGrid(first.elements, canvas);
  assert.deepEqual(second.elements, first.elements);
});

test("ocultos não ocupam espaço e a altura acompanha o conteúdo", () => {
  const { elements, height } = normalizeGrid([el("a", "chart", 0, 0, 600, 320), el("h", "chart", 0, 0, 600, 320, true)], canvas);
  assert.equal(elements[0].y, 0);
  assert.equal(height, 600, "mínimo de 30 linhas");
  const tall = normalizeGrid([el("a", "table", 0, 0, 1200, 2000)], canvas);
  assert.equal(tall.height, 2040);
});

test("nunca passa da largura", () => {
  const out = normalizeGrid([el("a", "chart", 1000, 0, 900, 320)], canvas).elements[0];
  assert.ok(out.x + out.w <= 1200);
});

test("autoGridLayout: título, filtros, indicadores e gráficos em ordem, sem sobreposição", () => {
  const input = [
    el("g1", "chart", 500, 400, 520, 320),
    el("k1", "kpi", 900, 10, 240, 132),
    el("t", "title", 700, 900, 460, 72),
    el("g2", "chart", 0, 0, 520, 320),
    el("k2", "kpi", 0, 600, 240, 132),
    el("f", "filter", 0, 300, 260, 92),
    el("tb", "table", 0, 1000, 560, 300),
    el("g3", "chart", 0, 1100, 520, 320),
  ];
  const { elements } = autoGridLayout(input, canvas);
  const by = Object.fromEntries(elements.map((e) => [e.id, e]));
  assert.equal(overlapAny(elements), false);
  assert.equal(by.t.y, 0);
  assert.ok(by.f.y > by.t.y && by.k1.y > by.f.y && by.g2.y > by.k1.y);
  assert.equal(by.k1.y, by.k2.y);
  assert.equal(by.k1.w, 600, "dois indicadores dividem a largura");
  assert.ok(by.g3.w === 1200 || by.g3.w === 600);
  assert.ok(elements.every((e) => e.x >= 0 && e.x + e.w <= 1200));
});

test("novo elemento vai para a primeira vaga livre", () => {
  const size = gridSize("chart", canvas);
  assert.deepEqual(size, { w: 600, h: 320 });
  const taken = [el("a", "chart", 0, 0, 600, 320)];
  assert.deepEqual(findGridSlot(size, taken, canvas), { x: 600, y: 0 });
  const full = [...taken, el("b", "chart", 600, 0, 600, 320)];
  assert.deepEqual(findGridSlot(size, full, canvas), { x: 0, y: 320 });
});

test("gráfico redondo sozinho na linha fica em meia largura", () => {
  const pie = { ...el("p", "chart", 0, 0, 600, 320), props: { chartType: "pie" } } as unknown as DashboardElement;
  const bar = { ...el("b", "chart", 0, 0, 600, 320), props: { chartType: "bar" } } as unknown as DashboardElement;
  assert.equal(autoGridLayout([pie], canvas).elements[0].w, 600);
  assert.equal(autoGridLayout([bar], canvas).elements[0].w, 1200);
});
