import assert from "node:assert/strict";
import { test } from "node:test";
import { frameCss } from "../lib/dashboards/frame.ts";

test("padrão: borda visível, cantos arredondados e fundo de cartão", () => {
  const css = frameCss(undefined, 12);
  assert.equal(css.border, "1px solid color-mix(in oklch, var(--foreground) 24%, transparent)");
  assert.equal(css.borderRadius, 12);
  assert.equal(css.background, "var(--card)");
  assert.equal(css.boxShadow, "none");
  assert.equal(css.padding, 12);
});

test("sem moldura: sem borda, fundo nem sombra (mantém o espaçamento)", () => {
  const css = frameCss({ enabled: false }, 12);
  assert.equal(css.border, "none");
  assert.equal(css.background, "transparent");
  assert.equal(css.boxShadow, "none");
  assert.equal(css.padding, 12);
});

test("personalizada", () => {
  const css = frameCss({ borderWidth: 3, borderColor: "#ff0000", borderStyle: "dashed", radius: 0, background: "transparent", padding: 4, shadow: "md" });
  assert.equal(css.border, "3px dashed #ff0000");
  assert.equal(css.borderRadius, 0);
  assert.equal(css.background, "transparent");
  assert.equal(css.padding, 4);
  assert.match(String(css.boxShadow), /0 4px 14px/);
});

test("espessura 0 remove só a borda", () => {
  const css = frameCss({ borderWidth: 0 });
  assert.equal(css.border, "none");
  assert.equal(css.background, "var(--card)");
});

test("o espaçamento informado vence o padrão do tipo de elemento", () => {
  assert.equal(frameCss({ padding: 0 }, 12).padding, 0);
  assert.equal(frameCss({}, 10).padding, 10);
});
