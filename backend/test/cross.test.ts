import "./setup";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ResultColumn } from "@shared/domain/sources";
import { toTableName } from "@shared/domain/sources";
import { openScratch } from "../src/sources/scratch";

const col = (name: string, kind: ResultColumn["kind"], dbType: string): ResultColumn => ({ name, kind, dbType });

test("cada fonte vira um esquema e o SQL cruza as tabelas pelo apelido", async () => {
  const scratch = await openScratch();
  try {
    await scratch.load(
      "pedidos",
      [col("cliente_id", "numero", "BIGINT"), col("valor", "numero", "DOUBLE")],
      [
        { cliente_id: 1, valor: 10 },
        { cliente_id: 1, valor: 5 },
        { cliente_id: 2, valor: 7 },
      ],
      "vendas_csv",
    );
    await scratch.load(
      "clientes",
      [col("id", "numero", "BIGINT"), col("nome", "texto", "VARCHAR")],
      [
        { id: 1, nome: "Ana" },
        { id: 2, nome: "Bia" },
      ],
      "erp",
    );
    const out = await scratch.execute(
      `SELECT c.nome, SUM(p.valor) AS total FROM vendas_csv.pedidos p JOIN erp.clientes c ON c.id = p.cliente_id GROUP BY c.nome ORDER BY c.nome`,
    );
    assert.deepEqual(
      out.rows.map((row) => [row.nome, Number(row.total)]),
      [
        ["Ana", 15],
        ["Bia", 7],
      ],
    );
  } finally {
    scratch.close();
  }
});

test("a área em memória não lê arquivos nem escreve fora de si", async () => {
  const scratch = await openScratch();
  try {
    await assert.rejects(scratch.execute(`SELECT * FROM read_csv('/etc/passwd')`));
  } finally {
    scratch.close();
  }
});

test("apelidos de fontes são únicos e seguros", () => {
  const taken = new Set<string>();
  assert.equal(toTableName("Vendas 2024.csv", taken), "vendas_2024");
  assert.equal(toTableName("Vendas 2024", taken), "vendas_2024_2");
  assert.equal(toTableName("ERP — Clientes", taken), "erp_clientes");
});
