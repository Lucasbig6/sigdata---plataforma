import assert from "node:assert/strict";
import { test } from "node:test";
import { mainTable, sourceSummary, suggestQuestions } from "../lib/workspace/suggestions.ts";

const col = (name: string, kind: string, extra: object = {}) => ({ name, kind, dbType: kind, ...extra });
const dist = (distintos: number) => ({ profile: { nulos: 0, nulosPct: 0, distintos, min: null, max: null, media: null } });

const municipios = {
  name: "municipios",
  rowCount: 6,
  columns: [col("municipio", "texto", dist(6)), col("indice", "numero", dist(6)), col("variacao_pct", "numero", dist(6)), col("receita_mi", "numero", dist(6))],
};
const serie = {
  name: "serie_mensal",
  rowCount: 12,
  columns: [col("mes", "texto", dist(12)), col("mes_num", "numero", dist(12)), col("indice_geral", "numero", dist(11))],
};

test("resumo da fonte", () => {
  assert.equal(sourceSummary([municipios, serie] as never), "2 tabelas · 18 linhas · 7 colunas");
  assert.equal(sourceSummary([] as never), "Nenhuma tabela encontrada nesta fonte.");
});

test("a tabela principal é a que mais permite análise, não só a maior", () => {
  assert.equal(mainTable([serie, municipios] as never)?.name, "municipios");
});

test("perguntas usam colunas que existem e ignoram colunas de ordem", () => {
  const perguntas = suggestQuestions([municipios, serie] as never);
  assert.ok(perguntas.length >= 3 && perguntas.length <= 4, `quantidade: ${perguntas.length}`);
  assert.match(perguntas[0], /municipios/);
  assert.ok(perguntas.some((p) => p.includes('"indice"') && p.includes('"municipio"')), "total por município");
  assert.ok(perguntas.some((p) => p.includes("evoluiu") && p.includes('"indice_geral"') && p.includes("serie_mensal")), "evolução no tempo");
  assert.ok(!perguntas.some((p) => p.includes('"mes_num"')), "mes_num é ordinal, não medida");
});

test("identificadores não viram medida", () => {
  const tabela = {
    name: "pedidos",
    rowCount: 100,
    columns: [col("id", "numero", dist(100)), col("cliente", "texto", dist(10)), col("valor", "numero", dist(80))],
  };
  const perguntas = suggestQuestions([tabela] as never);
  assert.ok(perguntas.some((p) => p.includes('"valor"') && p.includes('"cliente"')));
  assert.ok(!perguntas.some((p) => p.includes('"id"')));
});

test("sem tabelas não há sugestões", () => {
  assert.deepEqual(suggestQuestions([] as never), []);
});
