import assert from "node:assert/strict";
import { test } from "node:test";
import { splitStatements, statementAt } from "../lib/sql-editor/statements.ts";

const textos = (sql: string) => splitStatements(sql).map((s) => s.text);

test("separa instruções por ponto e vírgula", () => {
  assert.deepEqual(textos("select 1; select 2;\nselect 3"), ["select 1", "select 2", "select 3"]);
});

test("ignora ponto e vírgula em texto, identificador entre aspas e comentários", () => {
  assert.deepEqual(textos(`select ';' as x, "a;b" from t`), [`select ';' as x, "a;b" from t`]);
  assert.deepEqual(textos("select 'it''s;ok' as y"), ["select 'it''s;ok' as y"]);
  assert.deepEqual(textos("select 1 -- a; b\n; select 2"), ["select 1 -- a; b", "select 2"]);
  assert.deepEqual(textos("select /* a; b */ 1"), ["select /* a; b */ 1"]);
});

test("trechos só com comentário ou vazios não são instruções", () => {
  assert.deepEqual(textos("-- só comentário"), []);
  assert.deepEqual(textos(" ;; /* nada */ ; "), []);
  assert.deepEqual(textos(""), []);
});

test("statementAt: dentro, entre instruções e depois da última", () => {
  const doc = "select 1;\n\nselect 2;\nselect 3";
  assert.equal(statementAt(doc, 3)?.text, "select 1");
  assert.equal(statementAt(doc, doc.indexOf("select 2") + 3)?.text, "select 2");
  assert.equal(statementAt(doc, 10)?.text, "select 1", "linha em branco: vale a instrução anterior");
  assert.equal(statementAt(doc, doc.length)?.text, "select 3");
  assert.equal(statementAt("", 0), null);
});

test("as posições apontam para o texto original", () => {
  const doc = "  select 1 ;  select 2";
  for (const s of splitStatements(doc)) assert.equal(doc.slice(s.from, s.to), s.text);
});
