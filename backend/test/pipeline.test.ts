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

const cidades: SourceTable = {
  name: "cidades",
  rowCount: 3,
  columns: [
    { name: "nome", dbType: "VARCHAR", kind: "texto" },
    { name: "uf", dbType: "VARCHAR", kind: "texto" },
    { name: "valor", dbType: "BIGINT", kind: "numero" },
    { name: "populacao", dbType: "BIGINT", kind: "numero" },
  ],
};
const tables = [table, cidades];

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
    await conn.run(`CREATE TABLE cidades (nome VARCHAR, uf VARCHAR, valor BIGINT, populacao BIGINT)`);
    await conn.run(`INSERT INTO cidades VALUES ('Teresina', 'PI', 1, 866300), ('Parnaíba', 'PI', 2, 162159), ('Fortaleza', 'CE', 3, 2428678)`);
    await conn.run(`CREATE TABLE extra (cidade VARCHAR, bonus BIGINT)`);
    await conn.run(`INSERT INTO extra VALUES ('Fortaleza', 9), ('Teresina', 4)`);
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

const compile = (steps: Step[]) => compilePipeline(table, steps, "duckdb", tables);
const num = (value: unknown) => (value === null ? null : Number(value));

test("preencher nulos usa o tipo da coluna", async () => {
  const out = compile([step({ type: "preencher", column: "cidade", value: "(sem cidade)" })]);
  const rows = await run(out.sql);
  assert.equal(rows.filter((row) => row.cidade === "(sem cidade)").length, 1);
  assert.throws(() => compile([step({ type: "preencher", column: "dia", value: "x" })]), /não é uma data/);
});

test("agrupar: contagem, soma, média e distintos", async () => {
  const out = compile([
    step({ type: "tipo", column: "valor", to: "numero" }),
    step({
      type: "agrupar",
      by: ["cidade"],
      aggregations: [
        { column: null, fn: "contagem", as: "linhas" },
        { column: "valor", fn: "soma", as: "total" },
        { column: "valor", fn: "media", as: "média" },
        { column: "dia", fn: "maximo", as: "último dia" },
        { column: "ativo", fn: "distintos", as: "estados" },
      ],
    }),
    step({ type: "ordenar", column: "total", dir: "desc" }),
  ]);
  assert.deepEqual(out.columns.map((c) => [c.name, c.kind]), [
    ["cidade", "texto"], ["linhas", "numero"], ["total", "numero"], ["média", "numero"], ["último dia", "data"], ["estados", "numero"],
  ]);
  const rows = await run(out.sql);
  const teresina = rows.find((row) => row.cidade === "Teresina")!;
  assert.equal(num(teresina.linhas), 2);
  assert.equal(num(teresina.total), 20);
  assert.equal(num(teresina.média), 10);
  assert.equal(teresina["último dia"], "2024-01-05");
  assert.equal(rows.length, 5);
  assert.equal(rows[0]!.cidade, "Teresina", "ordenado pela soma, do maior para o menor");
});

test("agrupar valida colunas, nomes e tipos", () => {
  assert.throws(() => compile([step({ type: "agrupar", by: [], aggregations: [] })]), /Escolha colunas/);
  assert.throws(
    () => compile([step({ type: "agrupar", by: ["cidade"], aggregations: [{ column: "valor", fn: "soma", as: "t" }] })]),
    /não é numérica/,
  );
  assert.throws(
    () => compile([step({ type: "agrupar", by: ["cidade"], aggregations: [{ column: null, fn: "contagem", as: "CIDADE" }] })]),
    /duas colunas chamadas/,
  );
});

test("mesclar: esquerda, interna, completa e nomes repetidos", async () => {
  const left = compile([
    step({ type: "mesclar", table: "cidades", kind: "esquerda", on: [{ left: "cidade", right: "nome" }], columns: [] }),
  ]);
  assert.deepEqual(left.columns.map((c) => c.name), ["cidade", "valor", "dia", "ativo", "uf", "valor (cidades)", "populacao"]);
  const leftRows = await run(left.sql);
  assert.equal(leftRows.length, 6);
  assert.equal(leftRows.find((row) => row.cidade === "Parnaíba")!.uf, "PI");
  assert.equal(leftRows.find((row) => row.cidade === "Picos")!.uf, null);

  const inner = compile([
    step({ type: "mesclar", table: "cidades", kind: "interna", on: [{ left: "cidade", right: "nome" }], columns: ["populacao"] }),
  ]);
  assert.equal((await run(inner.sql)).length, 3);
  assert.deepEqual(inner.columns.map((c) => c.name).slice(-1), ["populacao"]);

  const full = compile([
    step({ type: "mesclar", table: "cidades", kind: "completa", on: [{ left: "cidade", right: "nome" }], columns: ["uf"] }),
  ]);
  const fullRows = await run(full.sql);
  assert.equal(fullRows.length, 7);
  assert.ok(fullRows.some((row) => row.cidade === "Fortaleza" && row.uf === "CE"), "a chave vem da outra tabela quando não casa");
});

test("mesclar valida tabela, colunas e tipos das chaves", () => {
  const merge = (value: Partial<Extract<Step, { type: "mesclar" }>>) =>
    compile([step({ type: "mesclar", table: "cidades", kind: "esquerda", on: [{ left: "cidade", right: "nome" }], columns: [], ...value })]);
  assert.throws(() => merge({ table: "outra" }), /não existe nesta fonte/);
  assert.throws(() => merge({ on: [] }), /ao menos um par/);
  assert.throws(() => merge({ on: [{ left: "cidade", right: "populacao" }] }), /tipos diferentes/);
  assert.throws(() => merge({ columns: ["nada"] }), /não existe em "cidades"/);
});

test("dinamizar vira colunas com a agregação de cada valor", async () => {
  const out = compile([
    step({ type: "tipo", column: "valor", to: "numero" }),
    step({ type: "dinamizar", column: "ativo", values: ["true", "false"], value: "valor", fn: "soma", by: ["cidade"] }),
  ]);
  assert.deepEqual(out.columns.map((c) => c.name), ["cidade", "true", "false"]);
  const rows = await run(out.sql);
  const teresina = rows.find((row) => row.cidade === "Teresina")!;
  assert.equal(num(teresina.true), 20);
  assert.equal(num(teresina.false), null);

  const counts = compile([step({ type: "dinamizar", column: "ativo", values: ["true"], value: "cidade", fn: "contagem", by: [] })]);
  assert.equal(num((await run(counts.sql))[0]!.true), 3); // conta "cidade" não nula entre as linhas ativas
  assert.throws(() => compile([step({ type: "dinamizar", column: "ativo", values: [], value: "valor", fn: "soma", by: [] })]), /ao menos um valor/);
  assert.throws(() => compile([step({ type: "dinamizar", column: "ativo", values: ["x"], value: "ativo", fn: "contagem", by: [] })]), /devem ser diferentes/);
});

const extra: SourceTable = {
  name: "extra",
  rowCount: 2,
  columns: [
    { name: "cidade", dbType: "VARCHAR", kind: "texto" },
    { name: "bonus", dbType: "BIGINT", kind: "numero" },
  ],
};

test("escolher mantém só as colunas pedidas, na ordem pedida", async () => {
  const out = compile([step({ type: "escolher", columns: ["dia", "cidade"] })]);
  assert.deepEqual(out.columns.map((c) => c.name), ["dia", "cidade"]);
  assert.deepEqual(Object.keys((await run(out.sql))[0]!), ["dia", "cidade"]);
  assert.throws(() => compile([step({ type: "escolher", columns: [] })]), /ao menos uma/);
});

test("limitar: manter ou remover as primeiras linhas, seguindo a ordenação", async () => {
  const keep = compile([step({ type: "ordenar", column: "dia", dir: "desc" }), step({ type: "limitar", mode: "manter", n: 2 })]);
  assert.deepEqual((await run(keep.sql)).map((row) => row.dia), ["2024-04-01", "2024-03-01"]);
  const drop = compile([step({ type: "limitar", mode: "remover", n: 4 })]);
  assert.equal((await run(drop.sql)).length, 2);
  assert.throws(() => compile([step({ type: "limitar", mode: "manter", n: 0 })]), /entre 1 e/);
});

test("dividir coluna em partes e substituir valores", async () => {
  const split = compile([
    step({ type: "dividir", column: "valor", delimiter: ",", parts: 2, removeOriginal: true }),
    step({ type: "filtrar", column: "valor.1", op: "=", value: "2" }),
  ]);
  assert.deepEqual(split.columns.map((c) => c.name), ["cidade", "dia", "ativo", "valor.1", "valor.2"]);
  const rows = await run(split.sql);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!["valor.2"], "5");

  const replaced = compile([step({ type: "substituir", column: "cidade", find: "Teresina", with: "THE" })]);
  assert.equal((await run(replaced.sql)).filter((row) => row.cidade === "THE").length, 2);
  assert.throws(() => compile([step({ type: "substituir", column: "dia", find: "a", with: "b" })]), /não é texto/);
});

test("coluna condicional, índice e cálculo", async () => {
  const out = compile([
    step({ type: "tipo", column: "valor", to: "numero" }),
    step({ type: "condicional", name: "faixa", column: "valor", op: ">=", value: 5, then: "alto", otherwise: "baixo" }),
    step({ type: "ordenar", column: "valor", dir: "asc" }),
    step({ type: "indice", name: "pos", start: 1 }),
    step({ type: "calcular", name: "dobro", left: "valor", op: "*", right: { value: 2 } }),
    step({ type: "calcular", name: "razão", left: "valor", op: "/", right: { column: "pos" } }),
  ]);
  assert.deepEqual(out.columns.slice(-4).map((c) => [c.name, c.kind]), [["faixa", "texto"], ["pos", "numero"], ["dobro", "numero"], ["razão", "numero"]]);
  const rows = await run(out.sql);
  const ten = rows.find((row) => num(row.valor) === 10)!;
  assert.equal(ten.faixa, "alto");
  assert.equal(num(ten.dobro), 20);
  assert.deepEqual(rows.map((row) => num(row.pos)).sort((a, b) => (a ?? 0) - (b ?? 0)), [1, 2, 3, 4, 5, 6]);
  assert.throws(() => compile([step({ type: "condicional", name: "x", column: "valor", op: "=", value: "a", then: "s", otherwise: 1 })]), /mesmo tipo/);
  assert.throws(() => compile([step({ type: "calcular", name: "novo", left: "cidade", op: "+", right: { value: 1 } })]), /não é numérica/);
});

test("divisão por zero vira nulo", async () => {
  const out = compile([
    step({ type: "tipo", column: "valor", to: "numero" }),
    step({ type: "calcular", name: "zero", left: "valor", op: "-", right: { column: "valor" } }),
    step({ type: "calcular", name: "razão", left: "valor", op: "/", right: { column: "zero" } }),
  ]);
  assert.ok((await run(out.sql)).every((row) => row.razão === null));
});

test("texto, parte da data e arredondar", async () => {
  const out = compile([
    step({ type: "texto", column: "cidade", fn: "maiusculas" }),
    step({ type: "data_parte", column: "dia", part: "trimestre", name: "tri" }),
    step({ type: "data_parte", column: "dia", part: "ano", name: "" }),
    step({ type: "tipo", column: "valor", to: "numero" }),
    step({ type: "arredondar", column: "valor", digits: 0 }),
  ]);
  assert.deepEqual(out.columns.map((c) => c.name).slice(-2), ["tri", "dia (ano)"]);
  const rows = await run(out.sql);
  assert.ok(rows.some((row) => row.cidade === "TERESINA"));
  assert.equal(num(rows.find((row) => row.cidade === "PICOS")!.tri), 1);
  assert.equal(num(rows.find((row) => row.cidade === "PICOS")!["dia (ano)"]), 2024);
  assert.throws(() => compile([step({ type: "data_parte", column: "cidade", part: "ano", name: "" })]), /não é uma data/);
});

test("filtrar por valores: incluir e excluir (mantendo nulos)", async () => {
  const include = compile([step({ type: "filtrar_valores", column: "cidade", values: ["Teresina", "Picos"], mode: "incluir" })]);
  assert.equal((await run(include.sql)).length, 3);
  const exclude = compile([step({ type: "filtrar_valores", column: "cidade", values: ["Teresina"], mode: "excluir" })]);
  assert.equal((await run(exclude.sql)).length, 4, "os nulos continuam");
  assert.throws(() => compile([step({ type: "filtrar_valores", column: "cidade", values: [], mode: "incluir" })]), /ao menos um valor/);
});

test("acrescentar casa colunas pelo nome", async () => {
  const withQuery = (steps: Step[]) => compilePipeline(table, steps, "duckdb", [table], { q2: { ...extra, name: "extra" } });
  const out = withQuery([step({ type: "acrescentar", query: "q2" })]);
  assert.deepEqual(out.columns.map((c) => c.name), ["cidade", "valor", "dia", "ativo", "bonus"]);
  const rows = await run(out.sql);
  assert.equal(rows.length, 8);
  assert.equal(rows.filter((row) => row.cidade === "Fortaleza").length, 1);
  assert.throws(() => compile([step({ type: "acrescentar", query: "q2" })]), /não está disponível/);
  assert.throws(() => compilePipeline(table, [step({ type: "acrescentar", query: "q2" })], "postgres", [table], { q2: extra }), /em memória/);
});

test("mesclar com outra consulta usa a tabela carregada", async () => {
  const out = compilePipeline(
    table,
    [step({ type: "mesclar", table: "", query: "q2", kind: "esquerda", on: [{ left: "cidade", right: "cidade" }], columns: ["bonus"] })],
    "duckdb",
    [table],
    { q2: extra },
  );
  const rows = await run(out.sql);
  assert.equal(rows.length, 6);
  assert.equal(num(rows.find((row) => row.cidade === "Parnaíba")!.bonus), null);
  assert.equal(rows.filter((row) => num(row.bonus) === 4).length, 2, "as duas linhas de Teresina");
  assert.throws(() => compile([step({ type: "mesclar", table: "", query: "q9", kind: "esquerda", on: [{ left: "cidade", right: "cidade" }], columns: [] })]), /não está disponível/);
});

test("o SQL de cada etapa fica disponível para a barra de fórmula", () => {
  const out = compile([step({ type: "ordenar", column: "cidade", dir: "asc" }), step({ type: "filtrar", column: "cidade", op: "nulo" })]);
  assert.equal(out.stepSql.length, 2);
  assert.equal(out.stepSql[0], `ORDER BY "cidade" ASC NULLS LAST`);
  assert.match(out.stepSql[1]!, /^SELECT \* FROM e0 WHERE "cidade" IS NULL$/);
});
