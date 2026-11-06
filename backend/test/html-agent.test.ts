import "./setup";
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAgentContext, elide, restore } from "../../frontend/lib/dashboards/html-agent/code-context";
import { HTML_AGENT_PROMPT } from "../src/html-agent";

const long = "var MAPA = " + JSON.stringify({ d: "M0 0L1 1".repeat(200) }) + ";";

test("linhas longas viram marcadores e voltam inteiras ao aplicar", () => {
  const code = { html: "<div id=a></div>", css: "a{color:red}", js: `${long}\nsigdata.onData(function(){});` };
  const { text, blobs } = elide(code);
  assert.ok(text.js.length < 200, "o contexto não carrega a linha longa");
  assert.match(text.js, /\/\*@@LONGO:j\d+@@\*\//);
  assert.equal(restore(text.js, blobs), code.js);
});

test("marcador de HTML usa comentário HTML e também é restaurado", () => {
  const html = `<div>\n${"x".repeat(400)}\n</div>`;
  const { text, blobs } = elide({ html, css: "", js: "" });
  assert.match(text.html, /<!--@@LONGO:h\d+@@-->/);
  assert.equal(restore(text.html, blobs), html);
});

test("marcador sem correspondência fica como está (o agente não perde nada em silêncio)", () => {
  assert.equal(restore("/*@@LONGO:j9@@*/", {}), "/*@@LONGO:j9@@*/");
});

test("o contexto traz código, colunas, amostra e erros, e corta partes enormes", () => {
  const big = Array.from({ length: 400 }, (_, i) => `var linha${i} = ${i};`).join("\n");
  const { context } = buildAgentContext({
    code: { html: "<div id=app></div>", css: "", js: big },
    columns: [{ name: "regiao", kind: "texto" }, { name: "valor", kind: "numero" }],
    sample: [{ regiao: "Sul", valor: 10 }],
    errors: ["ReferenceError: x is not defined"],
  });
  assert.match(context, /regiao \(texto\), valor \(numero\)/);
  assert.match(context, /"regiao":"Sul"/);
  assert.match(context, /ReferenceError/);
  assert.match(context, /restante cortado/);
  assert.ok(context.length < 6500, `contexto com ${context.length} caracteres`);
});

test("sem código nem dados, o agente é avisado", () => {
  const { context } = buildAgentContext({ code: { html: "", css: "", js: "" }, columns: [], sample: [], errors: [] });
  assert.match(context, /vazio/);
  assert.match(context, /Ainda não há dados ligados/);
});

test("as instruções ensinam a API do visual e os limites do ambiente", () => {
  for (const trecho of ["sigdata.onData", "sigdata.select", "sigdata.selection", "var(--sd-primary)", "cdn.jsdelivr.net", "textContent", "aplicar_codigo"]) {
    assert.ok(HTML_AGENT_PROMPT.includes(trecho), `falta ${trecho}`);
  }
  assert.ok(HTML_AGENT_PROMPT.length < 4200, `instruções com ${HTML_AGENT_PROMPT.length} caracteres`);
});
