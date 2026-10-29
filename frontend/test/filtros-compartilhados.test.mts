import assert from "node:assert/strict";
import { test } from "node:test";
import { FILTER_MULTI_SEP, joinMulti, parseRange, splitMulti } from "../../shared/dashboards/data.ts";

test("seleção múltipla: ida e volta preservando valores com símbolos", () => {
  const valores = ["Fluminense", "A; DROP TABLE x", "it's", 'aspas "duplas"', "a,b"];
  assert.deepEqual(splitMulti(joinMulti(valores)), valores);
});

test("seleção múltipla: vazio e valor único", () => {
  assert.deepEqual(splitMulti(""), []);
  assert.equal(joinMulti([]), "");
  assert.deepEqual(splitMulti("só um"), ["só um"]);
  assert.equal(joinMulti(["só um"]).includes(FILTER_MULTI_SEP), false);
});

test("intervalo de datas: pontas opcionais e formatos inválidos", () => {
  assert.deepEqual(parseRange("2024-01-01..2024-01-31"), { from: "2024-01-01", to: "2024-01-31" });
  assert.deepEqual(parseRange("2024-01-01.."), { from: "2024-01-01", to: "" });
  assert.deepEqual(parseRange("..2024-01-31"), { from: "", to: "2024-01-31" });
  assert.equal(parseRange(".."), null);
  assert.equal(parseRange("ontem..hoje"), null);
  assert.equal(parseRange("2024-01-01..2024-01-02..2024-01-03"), null);
});
