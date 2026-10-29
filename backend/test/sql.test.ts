import "./setup";
import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../src/http";
import { assertReadOnlySql } from "../src/sources/sql";

const recusa = (sql: string) =>
  assert.throws(
    () => assertReadOnlySql(sql),
    (error) => error instanceof HttpError && error.status === 400,
    `deveria recusar: ${JSON.stringify(sql.slice(0, 40))}`,
  );

test("aceita consultas de leitura e remove o ponto e vírgula final", () => {
  assert.equal(assertReadOnlySql("select 1"), "select 1");
  assert.equal(assertReadOnlySql("  SELECT * FROM t;;  "), "SELECT * FROM t");
  assert.equal(assertReadOnlySql("WITH a AS (SELECT 1) SELECT * FROM a"), "WITH a AS (SELECT 1) SELECT * FROM a");
  assert.equal(assertReadOnlySql("values (1), (2)"), "values (1), (2)");
  assert.equal(assertReadOnlySql("FROM t"), "FROM t"); // sintaxe do DuckDB
});

test("aceita comentários antes da consulta", () => {
  assert.equal(assertReadOnlySql("-- nota\nselect 1"), "-- nota\nselect 1");
  assert.equal(assertReadOnlySql("/* a; b */ select 1"), "/* a; b */ select 1");
});

test("recusa escrita, DDL e comandos administrativos", () => {
  for (const sql of [
    "drop table t",
    "delete from t",
    "insert into t values (1)",
    "update t set a = 1",
    "create table x as select 1",
    "alter table t add column c int",
    "truncate t",
    "copy t to '/tmp/x.csv'",
    "attach 'x.db'",
    "pragma database_list",
    "install httpfs",
  ]) {
    recusa(sql);
  }
});

test("recusa mais de uma instrução", () => {
  recusa("select 1; select 2");
  recusa("select 1; drop table t");
  recusa("select 1;\n-- x\ndelete from t");
});

test("recusa vazio e consulta longa demais", () => {
  recusa("");
  recusa("   ;  ");
  recusa(`select ${"x".repeat(20_001)}`);
});
