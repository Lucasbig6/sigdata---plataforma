import "./setup";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { DataSource } from "@shared/domain/sources";
import { arrangeElements } from "../../frontend/lib/dashboards/auto-layout";
import { ELEMENT_MIN, type DashboardElement } from "@shared/dashboards/types";
import { buildDashboardPrompt } from "../src/dashboard-chat";

const canvas = { width: 1600, height: 1000 };

const el = (id: string, type: DashboardElement["type"], w = 300, h = 200, x = 0, y = 0): DashboardElement =>
  ({ id, type, x, y, w, h, z: 0, hidden: false, props: {} }) as DashboardElement;

test("a arrumação põe título no topo, filtros em linha, indicadores lado a lado e o resto em grade", () => {
  const elements = [
    el("g1", "chart", 520, 320),
    el("k1", "kpi", 240, 132),
    el("t", "title", 460, 72),
    el("f1", "filter", 260, 92),
    el("k2", "kpi", 240, 132),
    el("g2", "chart", 520, 320),
    el("tab", "table", 560, 300),
  ];
  const { placements } = arrangeElements(elements, canvas);
  const at = (id: string) => placements.get(id)!;

  assert.ok(at("t").y < at("f1").y && at("f1").y < at("k1").y && at("k1").y < at("g1").y);
  assert.equal(at("k1").y, at("k2").y);
  assert.ok(at("k1").x < at("k2").x);
  assert.equal(at("g1").y, at("g2").y);
  assert.ok(at("g1").x < at("g2").x);
  assert.ok(at("tab").y > at("g1").y);
  assert.equal(at("tab").w, canvas.width - 48);
});

test("nada sai da tela e nenhum elemento fica menor que o mínimo do tipo", () => {
  const elements = [el("a", "chart"), el("b", "chart"), el("c", "kpi", 50, 50), el("d", "filter", 50, 50)];
  const { placements } = arrangeElements(elements, canvas);
  for (const [id, place] of placements) {
    const type = elements.find((entry) => entry.id === id)!.type;
    assert.ok(place.x >= 0 && place.x + place.w <= canvas.width, `${id} cabe na largura`);
    assert.ok(place.w >= ELEMENT_MIN[type].w && place.h >= ELEMENT_MIN[type].h, `${id} respeita o mínimo`);
  }
});

test("formas, divisores, imagens e elementos ocultos ficam como estão", () => {
  const hidden = { ...el("h", "chart"), hidden: true } as DashboardElement;
  const { placements } = arrangeElements([el("s", "shape"), el("d", "divider"), el("i", "image"), hidden, el("g", "chart")], canvas);
  assert.deepEqual([...placements.keys()], ["g"]);
});

test("a altura do conteúdo cresce com a quantidade de gráficos", () => {
  const few = arrangeElements([el("a", "chart")], canvas).contentHeight;
  const many = arrangeElements(Array.from({ length: 8 }, (_, i) => el(`c${i}`, "chart")), canvas).contentHeight;
  assert.ok(many > few);
});

const source = (id: string, name: string, tables = 1): DataSource =>
  ({
    id,
    name,
    description: "",
    kind: "dataset",
    status: "pronta",
    tables: Array.from({ length: tables }, (_, i) => ({
      name: `tabela_${i}`,
      rowCount: 10,
      columns: [
        { name: "regiao", dbType: "VARCHAR", kind: "texto" },
        { name: "valor", dbType: "DOUBLE", kind: "numero" },
      ],
    })),
  }) as unknown as DataSource;

test("o contexto do assistente lista ids, tabelas e colunas das fontes e as regras", () => {
  const prompt = buildDashboardPrompt([source("src-1", "Vendas")]);
  assert.match(prompt, /Fonte id=src-1 — "Vendas"/);
  assert.match(prompt, /tabela_0 — 10 linhas: regiao \(texto\), valor \(numero\)/);
  assert.match(prompt, /organizar_layout/);
  assert.match(prompt, /Use só fontes, tabelas e colunas listadas/);
});

test("sem fontes, o assistente é orientado a pedir um dataset", () => {
  assert.match(buildDashboardPrompt([]), /Nenhuma fonte disponível/);
});

test("o contexto limita fontes e tabelas para não estourar o prompt", () => {
  const many = Array.from({ length: 30 }, (_, i) => source(`s${i}`, `Fonte ${i}`, 40));
  const prompt = buildDashboardPrompt(many);
  assert.ok(!prompt.includes("Fonte id=s12"), "só as 12 primeiras fontes");
  assert.match(prompt, /e mais 15 tabelas/);
});

test("o que se reenvia a cada passo é enxuto (o plano gratuito do Groq aceita 7.000 tokens de entrada por minuto)", async () => {
  const { SCHEMAS } = await import("../../frontend/components/dashboards/agent/tool-schemas");
  const prompt = buildDashboardPrompt([source("src-1", "Vendas", 3)]);
  const schemaChars = JSON.stringify(SCHEMAS).length;
  // ~4 caracteres por token. Antes do enxugamento eram 6.100 caracteres de esquemas (~2.700 tokens por passo no total)
  assert.ok(schemaChars < 4400, `esquemas com ${schemaChars} caracteres`);
  assert.ok(prompt.length < 2600, `instruções com ${prompt.length} caracteres`);
});

test("cada ferramenta do assistente tem descrição e parâmetros do tipo objeto", async () => {
  const { SCHEMAS } = await import("../../frontend/components/dashboards/agent/tool-schemas");
  assert.deepEqual(Object.keys(SCHEMAS).sort(), [
    "adicionar_elemento", "adicionar_pagina", "editar_elemento", "ler_dashboard", "organizar_layout", "remover_elemento", "trocar_pagina",
  ]);
  for (const [name, def] of Object.entries(SCHEMAS)) {
    assert.ok(def.description.length > 10, name);
    assert.equal(def.parameters.type, "object", name);
  }
});
