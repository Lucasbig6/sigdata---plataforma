import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSchema } from "../lib/sql-editor/completions.ts";

const fonte = {
  tables: [
    {
      name: "vendas",
      rowCount: 1200,
      columns: [
        { name: "cidade", dbType: "VARCHAR", kind: "texto" },
        { name: "Valor Total", dbType: "DOUBLE", kind: "numero" },
      ],
    },
    {
      name: "public.clientes",
      rowCount: null,
      columns: [{ name: "id", dbType: "INTEGER", kind: "numero" }],
    },
  ],
};

test("tabela simples: nome, contagem de linhas e colunas com tipo", () => {
  const schema = buildSchema(fonte as never) as Record<string, any>;
  assert.equal(schema.vendas.self.label, "vendas");
  assert.match(schema.vendas.self.detail, /^1\.200 linhas$/);
  assert.deepEqual(schema.vendas.children.map((c: any) => c.label), ["cidade", "Valor Total"]);
  assert.equal(schema.vendas.children[0].detail, "varchar");
});

test("coluna com espaço é inserida entre aspas", () => {
  const schema = buildSchema(fonte as never) as Record<string, any>;
  const coluna = schema.vendas.children.find((c: any) => c.label === "Valor Total");
  assert.equal(coluna.apply, '"Valor Total"');
  assert.equal(schema.vendas.children[0].apply, "cidade");
});

test("schema.tabela fica aninhado e sugere só o nome da tabela depois do ponto", () => {
  const schema = buildSchema(fonte as never) as Record<string, any>;
  assert.equal(schema["public.clientes"], undefined);
  assert.equal(schema.public.clientes.self.label, "clientes");
  assert.equal(schema.public.clientes.self.apply, "clientes");
});

test("sem fonte, o esquema é vazio", () => {
  assert.deepEqual(buildSchema(null), {});
});
