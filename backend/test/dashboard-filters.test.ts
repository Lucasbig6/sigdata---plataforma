import "./setup";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ActiveFilter } from "@shared/dashboards/data";
import { joinMulti } from "@shared/dashboards/data";
import type { DataBinding } from "@shared/dashboards/types";
import type { SourceTable } from "@shared/domain/sources";
import { builderSql, filterConditions } from "../src/dashboard-data";
import { HttpError } from "../src/http";

const tabela: SourceTable = {
  name: "jogos",
  rowCount: 10,
  columns: [
    { name: "clube", dbType: "VARCHAR", kind: "texto" },
    { name: "data", dbType: "DATE", kind: "data" },
    { name: "gols", dbType: "INTEGER", kind: "numero" },
  ],
};

const filtro = (parcial: Partial<ActiveFilter>): ActiveFilter => ({
  sourceId: "s1",
  table: "jogos",
  column: "clube",
  value: "",
  ...parcial,
});

const erro400 = (error: unknown) => error instanceof HttpError && error.status === 400;

test("filtro vazio não gera condição", () => {
  assert.deepEqual(filterConditions("s1", tabela, [filtro({ value: "" })]), []);
});

test("um valor vira igualdade sobre texto", () => {
  assert.deepEqual(filterConditions("s1", tabela, [filtro({ value: "Fluminense" })]), [
    `CAST("clube" AS VARCHAR) = 'Fluminense'`,
  ]);
});

test("vários valores marcados viram IN (...)", () => {
  const value = joinMulti(["Fluminense", "Sao Paulo", "Internacional"]);
  assert.deepEqual(filterConditions("s1", tabela, [filtro({ value })]), [
    `CAST("clube" AS VARCHAR) IN ('Fluminense', 'Sao Paulo', 'Internacional')`,
  ]);
});

test("aspas e injeção são escapadas em cada valor", () => {
  const [um] = filterConditions("s1", tabela, [filtro({ value: "x' OR '1'='1" })]);
  assert.equal(um, `CAST("clube" AS VARCHAR) = 'x'' OR ''1''=''1'`);
  const [varios] = filterConditions("s1", tabela, [filtro({ value: joinMulti(["a'; DROP TABLE jogos; --", "b"]) })]);
  assert.equal(varios, `CAST("clube" AS VARCHAR) IN ('a''; DROP TABLE jogos; --', 'b')`);
});

test("limites: valores demais e valor longo demais", () => {
  const muitos = joinMulti(Array.from({ length: 51 }, (_, i) => `v${i}`));
  assert.throws(() => filterConditions("s1", tabela, [filtro({ value: muitos })]), erro400);
  assert.throws(() => filterConditions("s1", tabela, [filtro({ value: "x".repeat(1001) })]), erro400);
  const cinquenta = joinMulti(Array.from({ length: 50 }, (_, i) => `v${i}`));
  assert.equal(filterConditions("s1", tabela, [filtro({ value: cinquenta })]).length, 1);
});

test("coluna inexistente é recusada", () => {
  assert.throws(() => filterConditions("s1", tabela, [filtro({ column: "nao_existe", value: "a" })]), erro400);
});

test("filtro de outra fonte ou tabela é ignorado; global vale se a coluna existir", () => {
  assert.deepEqual(filterConditions("s1", tabela, [filtro({ sourceId: "s2", value: "a" })]), []);
  assert.deepEqual(filterConditions("s1", tabela, [filtro({ table: "outra", value: "a" })]), []);
  assert.equal(filterConditions("s1", tabela, [filtro({ sourceId: "s2", table: "x", value: "a", byName: true })]).length, 1);
  assert.deepEqual(filterConditions("s1", tabela, [filtro({ column: "inexistente", value: "a", byName: true, sourceId: "s2", table: "x" })]), []);
});

test("período: intervalo fechado, aberto nas pontas e datas inválidas", () => {
  const [fechado] = filterConditions("s1", tabela, [filtro({ column: "data", value: "2024-01-01..2024-01-31", range: true })]);
  assert.equal(fechado, `CAST("data" AS DATE) >= DATE '2024-01-01' AND CAST("data" AS DATE) <= DATE '2024-01-31'`);
  const [soInicio] = filterConditions("s1", tabela, [filtro({ column: "data", value: "2024-01-01..", range: true })]);
  assert.equal(soInicio, `CAST("data" AS DATE) >= DATE '2024-01-01'`);
  const [soFim] = filterConditions("s1", tabela, [filtro({ column: "data", value: "..2024-01-31", range: true })]);
  assert.equal(soFim, `CAST("data" AS DATE) <= DATE '2024-01-31'`);
  for (const value of ["2024-02-31..2024-03-01", "ontem..hoje", "2024-01-01..2024-01-02..2024-01-03"]) {
    assert.throws(() => filterConditions("s1", tabela, [filtro({ column: "data", value, range: true })]), erro400, value);
  }
});

test("o SQL do gráfico leva os filtros no WHERE", () => {
  const binding: DataBinding = { sourceId: "s1", mode: "builder", table: "jogos", dimension: "clube", measure: "gols", agg: "sum" };
  const sql = builderSql(binding, [tabela], [filtro({ value: joinMulti(["A", "B"]) })]);
  assert.match(sql, /WHERE CAST\("clube" AS VARCHAR\) IN \('A', 'B'\)/);
  assert.match(sql, /GROUP BY/);
});
