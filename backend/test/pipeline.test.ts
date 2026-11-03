import "./setup";
import assert from "node:assert/strict";
import { test } from "node:test";
import { DuckDBInstance } from "@duckdb/node-api";
import type { SourceTable } from "@shared/domain/sources";
import type { Step } from "@shared/domain/transform";
import { quoteIdent } from "../src/sources/sql";
import { compilePipeline, profileSql, readProfile } from "../src/sources/pipeline";

const table: SourceTable = {
  name: "vendas",
  rowCount: 6,
  columns: [
    { name: "cidade", dbType: "VARCHAR", kind: "texto" },
    { name: "valor", dbType: "VARCHAR", kind: "texto" },
    { name: "dia", dbType: "DATE", kind: "data" },
    { name: "ativo", dbType: "BOOLEAN", kind: "booleano" },
  ],
};

let seq = 0;
type StepInput = Step extends infer S ? (S extends Step ? Omit<S, "id"> : never) : never;
const step = (value: StepInput): Step => ({ ...value, id: `s${++seq}` }) as Step;

/** Roda o SQL num DuckDB em memória com a tabela `vendas` populada. */
const run = async (sql: string) => {
  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();
  try {
    await conn.run(`CREATE TABLE vendas (cidade VARCHAR, valor VARCHAR, dia DATE, ativo BOOLEAN)`);
    await conn.run(`INSERT INTO vendas VALUES
      ('Teresina', '10', '2024-01-05', true),
      ('Teresina', '10', '2024-01-05', true),
      ('Parnaíba', '2,5', '2024-02-10', false),
      ('Picos', 'abc', '2024-03-01', NULL),
      (NULL, '7', NULL, true),
      ('O''Brien; 50%', '3', '2024-04-01', true)`);
    const result = await conn.runAndReadAll(sql);
    return (await result.getRowObjectsJson()) as Record<string, unknown>[];
  } finally {
    conn.closeSync();
    instance.closeSync();
  }
};

test("sem etapas, devolve a tabela com as colunas explícitas", () => {
  const out = compilePipeline(table, [], "duckdb");
  assert.match(out.sql, /^WITH e0 AS \(SELECT "cidade", "valor", "dia", "ativo" FROM "vendas"\)\nSELECT \* FROM e0$/);
  assert.deepEqual(out.columns.map((c) => c.name), ["cidade", "valor", "dia", "ativo"]);
});

test("filtrar, renomear, remover e tipo rodam no DuckDB", async () => {
  const out = compilePipeline(
    table,
    [
      step({ type: "tipo", column: "valor", to: "numero" }),
      step({ type: "filtrar", column: "valor", op: ">=", value: 5 }),
      step({ type: "renomear", from: "cidade", to: "município" }),
      step({ type: "remover", columns: ["ativo", "dia"] }),
      step({ type: "ordenar", column: "valor", dir: "desc" }),
    ],
    "duckdb",
  );
  assert.deepEqual(out.columns, [
    { name: "município", kind: "texto" },
    { name: "valor", kind: "numero" },
  ]);
  const rows = await run(out.sql);
  assert.deepEqual(rows, [
    { município: "Teresina", valor: 10 },
    { município: "Teresina", valor: 10 },
    { município: null, valor: 7 },
  ]);
});

test("TRY_CAST no DuckDB vira nulo quando não converte", async () => {
  const out = compilePipeline(table, [step({ type: "tipo", column: "valor", to: "numero" })], "duckdb");
  const rows = await run(out.sql);
  assert.equal(rows.filter((row) => row.valor === null).length, 2); // 'abc' e '2,5'
});

test("filtros de texto: igual, diferente (inclui nulos) e contém com curingas literais", async () => {
  const ids = async (steps: Step[]) => (await run(compilePipeline(table, steps, "duckdb").sql)).length;
  assert.equal(await ids([step({ type: "filtrar", column: "cidade", op: "=", value: "Teresina" })]), 2);
  assert.equal(await ids([step({ type: "filtrar", column: "cidade", op: "!=", value: "Teresina" })]), 4);
  assert.equal(await ids([step({ type: "filtrar", column: "cidade", op: "contem", value: "50%" })]), 1);
  assert.equal(await ids([step({ type: "filtrar", column: "cidade", op: "contem", value: "%" })]), 1);
  assert.equal(await ids([step({ type: "filtrar", column: "cidade", op: "nulo" })]), 1);
  assert.equal(await ids([step({ type: "filtrar", column: "dia", op: ">=", value: "2024-02-01" })]), 3);
  assert.equal(await ids([step({ type: "filtrar", column: "ativo", op: "=", value: "true" })]), 4);
});

test("remover nulos e duplicadas", async () => {
  const noNulls = compilePipeline(table, [step({ type: "remover_nulos", columns: ["cidade", "dia"] })], "duckdb");
  assert.equal((await run(noNulls.sql)).length, 5);

  const dedupe = compilePipeline(table, [step({ type: "duplicadas", columns: [] })], "duckdb");
  assert.equal((await run(dedupe.sql)).length, 5);
  assert.deepEqual(Object.keys((await run(dedupe.sql))[0]!), ["cidade", "valor", "dia", "ativo"]);

  const byCity = compilePipeline(table, [step({ type: "duplicadas", columns: ["cidade"] })], "duckdb");
  assert.equal((await run(byCity.sql)).length, 5); // Teresina, Parnaíba, Picos, nulo, O'Brien
});

test("a ordenação acompanha a renomeação e some se a coluna é removida", () => {
  const renamed = compilePipeline(
    table,
    [step({ type: "ordenar", column: "cidade", dir: "asc" }), step({ type: "renomear", from: "cidade", to: "local" })],
    "duckdb",
  );
  assert.match(renamed.sql, /ORDER BY "local" ASC NULLS LAST$/);

  const removed = compilePipeline(
    table,
    [step({ type: "ordenar", column: "cidade", dir: "asc" }), step({ type: "remover", columns: ["cidade"] })],
    "duckdb",
  );
  assert.doesNotMatch(removed.sql, /ORDER BY/);
});

test("Postgres usa tipos e CAST próprios", () => {
  const out = compilePipeline(table, [step({ type: "tipo", column: "valor", to: "numero" })], "postgres");
  assert.match(out.sql, /CAST\("valor" AS DOUBLE PRECISION\)/);
  assert.doesNotMatch(out.sql, /TRY_CAST/);
});

test("erros apontam a etapa certa", () => {
  const cases: { steps: Step[]; step: number; message: RegExp }[] = [
    {
      steps: [step({ type: "remover", columns: ["valor"] }), step({ type: "filtrar", column: "valor", op: "=", value: 1 })],
      step: 1,
      message: /^Etapa 2 \(Filtrar linhas\): A coluna "valor" não existe/,
    },
    { steps: [step({ type: "renomear", from: "cidade", to: "valor" })], step: 0, message: /Já existe uma coluna/ },
    { steps: [step({ type: "renomear", from: "cidade", to: "  " })], step: 0, message: /Informe o novo nome/ },
    { steps: [step({ type: "remover", columns: ["cidade", "valor", "dia", "ativo"] })], step: 0, message: /todas as colunas/ },
    { steps: [step({ type: "filtrar", column: "dia", op: ">", value: "ontem" })], step: 0, message: /não é uma data/ },
    { steps: [step({ type: "filtrar", column: "ativo", op: ">", value: "true" })], step: 0, message: /igual ou diferente/ },
    { steps: [step({ type: "filtrar", column: "cidade", op: "=" })], step: 0, message: /Informe o valor/ },
  ];
  for (const { steps, step: index, message } of cases) {
    assert.throws(
      () => compilePipeline(table, steps, "duckdb"),
      (error) => (error as { stepIndex?: number }).stepIndex === index && message.test((error as Error).message),
      message.source,
    );
  }
});

test("validações gerais: ids repetidos e excesso de etapas", () => {
  const dup = step({ type: "ordenar", column: "cidade", dir: "asc" });
  assert.throws(() => compilePipeline(table, [dup, dup], "duckdb"), /mesmo identificador/);
  const many = Array.from({ length: 51 }, () => step({ type: "ordenar", column: "cidade", dir: "asc" }));
  assert.throws(() => compilePipeline(table, many, "duckdb"), /no máximo 50/);
});

test("nomes e valores maliciosos ficam escapados", async () => {
  const hostile = `x"; DROP TABLE vendas; --`;
  const out = compilePipeline(
    { ...table, columns: [...table.columns, { name: hostile, dbType: "VARCHAR", kind: "texto" }] },
    [step({ type: "filtrar", column: "cidade", op: "=", value: `' OR 1=1; --` })],
    "duckdb",
  );
  assert.ok(out.sql.includes(`"x""; DROP TABLE vendas; --"`));
  assert.ok(out.sql.includes(`''' OR 1=1; --'`));
  // o valor hostil é só texto comparado: nenhuma linha casa
  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();
  try {
    await conn.run(`CREATE TABLE vendas (cidade VARCHAR, valor VARCHAR, dia DATE, ativo BOOLEAN, ${quoteIdent(hostile)} VARCHAR)`);
    await conn.run(`INSERT INTO vendas VALUES ('a', '1', NULL, NULL, 'z')`);
    const rows = (await (await conn.runAndReadAll(out.sql)).getRowObjectsJson()) as unknown[];
    assert.equal(rows.length, 0);
    const still = await conn.runAndReadAll(`SELECT count(*) AS n FROM vendas`);
    assert.equal(Number((await still.getRowObjectsJson())[0]!.n), 1);
  } finally {
    conn.closeSync();
    instance.closeSync();
  }
});

test("perfil das colunas do resultado", async () => {
  const out = compilePipeline(table, [step({ type: "tipo", column: "valor", to: "numero" })], "duckdb");
  const [row] = await run(profileSql(out.sql, out.columns, "duckdb"));
  const { total, profiles } = readProfile(out.columns, row!);
  assert.equal(total, 6);
  assert.equal(profiles.cidade!.nulos, 1);
  assert.equal(profiles.cidade!.distintos, 4);
  assert.equal(profiles.valor!.nulos, 2);
  assert.equal(profiles.valor!.max, "10.0");
  assert.equal(profiles.dia!.min, "2024-01-05");
});
