import "./setup";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import type { ApiConnectionInput } from "@shared/domain/sources";
import { fetchApiRows, sheetsExportUrl } from "../src/sources/imports";
import { assertSelectOnly } from "../src/sources/mssql";
import { safeGet } from "../src/sources/http-fetch";

let server: Server;
let base = "";
const seen: { auth?: string | undefined; urls: string[] } = { urls: [] };

before(async () => {
  server = createServer((req, res) => {
    seen.auth = req.headers.authorization;
    seen.urls.push(req.url ?? "");
    const url = new URL(req.url ?? "/", "http://x");
    res.setHeader("content-type", "application/json");
    if (url.pathname === "/lista") {
      res.end(JSON.stringify([{ id: 1, nome: "A", dono: { cidade: "X" }, tags: ["a", "b"] }, { id: 2, nome: "B", extra: true }]));
    } else if (url.pathname === "/paginas") {
      const page = Number(url.searchParams.get("page"));
      res.end(JSON.stringify({ data: { items: page <= 2 ? [{ id: page }] : [] } }));
    } else if (url.pathname === "/ignora-pagina") {
      res.end(JSON.stringify([{ id: 1 }]));
    } else if (url.pathname === "/encadeada") {
      const n = Number(url.searchParams.get("n") ?? 1);
      res.end(JSON.stringify({ results: [{ n }], next: n < 3 ? `/encadeada?n=${n + 1}` : null }));
    } else if (url.pathname === "/redireciona") {
      res.statusCode = 302;
      res.setHeader("location", "/lista");
      res.end();
    } else if (url.pathname === "/negado") {
      res.statusCode = 401;
      res.end("{}");
    } else {
      res.end("não é json");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => server.close());

const cfg = (patch: Partial<ApiConnectionInput> & { path: string }): ApiConnectionInput => ({
  url: `${base}${patch.path}`,
  headers: [],
  recordsPath: "",
  pagination: { type: "none" },
  maxPages: 10,
  ...patch,
});

test("API: lista na raiz vira linhas planas com a união das colunas", async () => {
  const rows = await fetchApiRows(cfg({ path: "/lista" }));
  assert.equal(rows.length, 2);
  assert.deepEqual(Object.keys(rows[0]!), ["id", "nome", "dono_cidade", "tags", "extra"]);
  assert.equal(rows[0]!.dono_cidade, "X");
  assert.equal(rows[0]!.tags, '["a","b"]');
  assert.equal(rows[1]!.dono_cidade, null);
});

test("API: envia o cabeçalho de autenticação", async () => {
  await fetchApiRows(cfg({ path: "/lista", headers: [{ name: "Authorization", value: "Bearer abc" }] }));
  assert.equal(seen.auth, "Bearer abc");
});

test("API: pagina por número até a página vazia e usa o caminho dos registros", async () => {
  const rows = await fetchApiRows(
    cfg({ path: "/paginas", recordsPath: "data.items", pagination: { type: "page", param: "page", start: 1 } }),
  );
  assert.deepEqual(rows.map((row) => row.id), [1, 2]);
});

test("API: para quando a API ignora o parâmetro de página", async () => {
  const rows = await fetchApiRows(cfg({ path: "/ignora-pagina", pagination: { type: "page", param: "page", start: 1 }, maxPages: 50 }));
  assert.equal(rows.length, 1);
});

test("API: segue o link da próxima página", async () => {
  const rows = await fetchApiRows(cfg({ path: "/encadeada", recordsPath: "results", pagination: { type: "next", path: "next" } }));
  assert.deepEqual(rows.map((row) => row.n), [1, 2, 3]);
});

test("API: segue redirecionamento e explica erro de acesso", async () => {
  assert.equal((await fetchApiRows(cfg({ path: "/redireciona" }))).length, 2);
  await assert.rejects(fetchApiRows(cfg({ path: "/negado" })), /acesso negado/);
  await assert.rejects(fetchApiRows(cfg({ path: "/texto" })), /JSON válido/);
  await assert.rejects(fetchApiRows(cfg({ path: "/lista", recordsPath: "nada.aqui" })), /não aponta para uma lista/);
});

test("API: recusa cabeçalho inválido e endereço com usuário/senha", async () => {
  await assert.rejects(fetchApiRows(cfg({ path: "/lista", headers: [{ name: "X\r\nY", value: "1" }] })), /Cabeçalho inválido/);
  await assert.rejects(safeGet("http://u:p@127.0.0.1/x"), /usuário e senha/);
  await assert.rejects(safeGet("ftp://exemplo.com/x"), /http/);
});

test("em produção a API não alcança rede interna", async () => {
  const antes = { env: process.env.NODE_ENV, allow: process.env.SIGDATA_ALLOW_PRIVATE_HOSTS };
  try {
    delete process.env.SIGDATA_ALLOW_PRIVATE_HOSTS;
    process.env.NODE_ENV = "production";
    await assert.rejects(safeGet(`${base}/lista`), /rede interna/);
  } finally {
    if (antes.env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = antes.env;
    if (antes.allow !== undefined) process.env.SIGDATA_ALLOW_PRIVATE_HOSTS = antes.allow;
  }
});

test("Google Sheets: monta o endereço de exportação e recusa outros hosts", () => {
  assert.equal(
    sheetsExportUrl("https://docs.google.com/spreadsheets/d/AbC_1-x/edit#gid=123"),
    "https://docs.google.com/spreadsheets/d/AbC_1-x/export?format=csv&gid=123",
  );
  assert.equal(
    sheetsExportUrl("https://docs.google.com/spreadsheets/d/AbC/edit?usp=sharing"),
    "https://docs.google.com/spreadsheets/d/AbC/export?format=csv",
  );
  assert.throws(() => sheetsExportUrl("https://exemplo.com/spreadsheets/d/AbC"), /link da planilha/);
  assert.throws(() => sheetsExportUrl("http://docs.google.com/spreadsheets/d/AbC"), /link da planilha/);
});

test("SQL Server: aceita leitura e recusa escrita e procedimentos", () => {
  assert.doesNotThrow(() => assertSelectOnly("WITH a AS (SELECT 1 AS x) SELECT * FROM a ORDER BY x"));
  assert.doesNotThrow(() => assertSelectOnly("SELECT 'into exec' AS texto, [into] FROM t -- exec x"));
  assert.throws(() => assertSelectOnly("SELECT * INTO copia FROM t"), /INTO/);
  assert.throws(() => assertSelectOnly("SELECT 1; EXEC sp_who"), /EXEC/);
  assert.throws(() => assertSelectOnly("SELECT * FROM OPENROWSET('x','y','z')"), /OPENROWSET/);
});
