import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeQuality } from "../lib/workspace/quality.ts";

const col = (name: string, profile: object) => ({
  name,
  kind: "texto",
  dbType: "VARCHAR",
  profile: { nulos: 0, nulosPct: 0, distintos: 10, min: null, max: null, media: null, ...profile },
});

test("aponta vazios, constantes e identificador repetido, do mais grave ao menos", () => {
  const issues = analyzeQuality([
    {
      name: "atendimentos",
      rowCount: 100,
      columns: [
        col("id_atendimento", { distintos: 95 }),
        col("observacao", { nulosPct: 62 }),
        col("unidade", { nulosPct: 8 }),
        col("pais", { distintos: 1 }),
        col("municipio", {}),
      ],
    },
  ] as never);
  assert.deepEqual(
    issues.map((issue) => [issue.column, issue.severity]),
    [
      ["observacao", "alerta"],
      ["id_atendimento", "atencao"],
      ["unidade", "atencao"],
      ["pais", "info"],
    ],
  );
});

test("tabela vazia é alerta e dados sem problemas não geram avisos", () => {
  assert.equal(analyzeQuality([{ name: "vazia", rowCount: 0, columns: [] }] as never)[0]?.severity, "alerta");
  assert.deepEqual(analyzeQuality([{ name: "ok", rowCount: 10, columns: [col("a", {})] }] as never), []);
});
