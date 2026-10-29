import { STORAGE_TESTE } from "./setup";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { after, before, test } from "node:test";
import { HttpError } from "../src/http";
import { ingestRows, queryDuck, removeDuckFiles } from "../src/sources/duck";

const ID = "teste-paginacao";
const ORDENADO = "SELECT n FROM numeros ORDER BY n";

before(async () => {
  await ingestRows(ID, [{ name: "numeros", rows: Array.from({ length: 130 }, (_, n) => ({ n })) }]);
});

after(async () => {
  await removeDuckFiles(ID);
  rmSync(STORAGE_TESTE, { recursive: true, force: true });
});

test("paginação: páginas cheias, última parcial e além do fim", async () => {
  const p1 = await queryDuck(ID, ORDENADO, 50, 0);
  assert.equal(p1.rows.length, 50);
  assert.equal(Number(p1.rows[0].n), 0);
  assert.equal(Number(p1.rows[49].n), 49);
  assert.equal(p1.truncated, true);

  const p2 = await queryDuck(ID, ORDENADO, 50, 50);
  assert.equal(Number(p2.rows[0].n), 50);
  assert.equal(p2.truncated, true);

  const p3 = await queryDuck(ID, ORDENADO, 50, 100);
  assert.equal(p3.rows.length, 30);
  assert.equal(Number(p3.rows[29].n), 129);
  assert.equal(p3.truncated, false);

  const alem = await queryDuck(ID, ORDENADO, 50, 150);
  assert.equal(alem.rows.length, 0);
  assert.equal(alem.truncated, false);
});

test("tamanho exato da tabela não marca como truncado", async () => {
  const todas = await queryDuck(ID, ORDENADO, 130, 0);
  assert.equal(todas.rows.length, 130);
  assert.equal(todas.truncated, false);
});

test("consulta terminada em comentário de linha ou de bloco funciona", async () => {
  const linha = await queryDuck(ID, `${ORDENADO} -- comentário no fim`, 3, 0);
  assert.equal(linha.rows.length, 3);
  const bloco = await queryDuck(ID, `${ORDENADO} /* bloco */`, 3, 0);
  assert.equal(bloco.rows.length, 3);
});

test("o motor é somente leitura: escrita e leitura de arquivos do servidor falham", async () => {
  const erro = (error: unknown) => error instanceof HttpError && error.status === 400;
  await assert.rejects(() => queryDuck(ID, "DELETE FROM numeros"), erro);
  await assert.rejects(() => queryDuck(ID, "WITH x AS (SELECT 1) DELETE FROM numeros"), erro);
  await assert.rejects(() => queryDuck(ID, "SELECT * FROM read_csv('/etc/passwd')"), erro);
  const depois = await queryDuck(ID, "SELECT count(*) AS c FROM numeros", 1, 0);
  assert.equal(Number(depois.rows[0].c), 130, "a tabela deve continuar com 130 linhas");
});

test("valores nulos e objetos viram CSV seguro na criação do dataset", async () => {
  const id = "teste-nulos";
  try {
    const tabelas = await ingestRows(id, [
      { name: "mistura", rows: [{ a: 1, b: "x", c: null }, { a: 2, b: null, c: { k: 1 } }] },
    ]);
    assert.equal(tabelas[0].rowCount, 2);
    const out = await queryDuck(id, "SELECT a, b FROM mistura ORDER BY a", 10, 0);
    assert.equal(out.rows.length, 2);
    assert.equal(out.rows[1].b, null, "texto vazio no CSV deve virar NULL");
  } finally {
    await removeDuckFiles(id);
  }
});
