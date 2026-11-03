import "./setup";
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSandboxDoc, HTML_CSP } from "@shared/dashboards/html-sandbox";
import { HTML_CODE_MAX, type Dashboard, type DashboardElement } from "@shared/dashboards/types";
import { assertCustomCode } from "../src/dashboards";
import type { CurrentUser } from "../src/http";

const user = (role: CurrentUser["role"]): CurrentUser => ({ id: "u1", name: "Ana", email: "ana@example.com", role });

const visual = (id: string, code: { html?: string; css?: string; js?: string } = {}): DashboardElement =>
  ({
    id,
    type: "html",
    x: 0,
    y: 0,
    w: 520,
    h: 320,
    z: 0,
    hidden: false,
    props: { title: "V", showTitle: false, html: code.html ?? "<p>oi</p>", css: code.css ?? "", js: code.js ?? "" },
  }) as DashboardElement;

const doc = (...elements: DashboardElement[]): Pick<Dashboard, "elements"> => ({ elements });

test("a política bloqueia rede e só libera as bibliotecas combinadas", () => {
  assert.match(HTML_CSP, /default-src 'none'/);
  assert.match(HTML_CSP, /connect-src 'none'/);
  assert.match(HTML_CSP, /img-src data: blob:/);
  assert.match(HTML_CSP, /form-action 'none'/);
  assert.match(HTML_CSP, /script-src 'unsafe-inline' https:\/\/cdnjs\.cloudflare\.com https:\/\/cdn\.jsdelivr\.net https:\/\/unpkg\.com/);
  assert.doesNotMatch(HTML_CSP, /script-src[^;]*\*/);
});

test("o documento começa pela política e traz o código do autor depois da ponte", () => {
  const out = buildSandboxDoc({ html: "<div id=a></div>", css: "#a{color:red}", js: "window.x = 1;" });
  const csp = out.indexOf("Content-Security-Policy");
  const html = out.indexOf("<div id=a>");
  const bridge = out.indexOf("window.sigdata = api");
  const js = out.indexOf("window.x = 1;");
  assert.ok(csp > 0 && csp < html && html < bridge && bridge < js);
});

test("o código do autor não consegue fechar a tag em que foi colocado", () => {
  const out = buildSandboxDoc({ html: "", css: "a{} </style><script>alert(1)</script>", js: "var s = '</script><img src=x>';" });
  assert.doesNotMatch(out, /<\/style><script>alert\(1\)/);
  assert.doesNotMatch(out, /'<\/script><img/);
});

test("sem papel de analista, criar ou alterar o código é recusado", () => {
  assert.throws(() => assertCustomCode(user("usuario"), doc(visual("h1"))), /Só analistas/);
  assert.doesNotThrow(() => assertCustomCode(user("analista"), doc(visual("h1"))));
  assert.doesNotThrow(() => assertCustomCode(user("admin"), doc(visual("h1"))));
});

test("quem perdeu o papel ainda salva o painel se o código não mudou", () => {
  const saved = [visual("h1", { js: "a()" })];
  assert.doesNotThrow(() => assertCustomCode(user("usuario"), doc(visual("h1", { js: "a()" })), saved));
  assert.throws(() => assertCustomCode(user("usuario"), doc(visual("h1", { js: "b()" })), saved), /Só analistas/);
  assert.throws(() => assertCustomCode(user("usuario"), doc(visual("h1", { js: "a()" }), visual("h2")), saved), /Só analistas/);
});

test("painéis sem visual personalizado não passam por nenhuma checagem", () => {
  assert.doesNotThrow(() => assertCustomCode(user("usuario"), doc()));
});

test("código grande demais ou fora do formato é recusado", () => {
  assert.throws(() => assertCustomCode(user("analista"), doc(visual("h1", { js: "x".repeat(HTML_CODE_MAX + 1) }))), /até/);
  const broken = { ...visual("h1"), props: { title: "V", html: 3 } } as unknown as DashboardElement;
  assert.throws(() => assertCustomCode(user("analista"), doc(broken)), /inválido/);
});
