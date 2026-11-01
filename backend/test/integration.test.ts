/**
 * Testes de integração contra um Postgres real (banco descartável `sigdata_test`).
 * Sem Postgres disponível, os testes são pulados. Configure o servidor com
 * TEST_PG_ADMIN_URL (padrão: o Postgres do `npm run db:up`).
 */
import "./setup";
import assert from "node:assert/strict";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client, Pool } from "pg";

const ADMIN_URL = process.env.TEST_PG_ADMIN_URL ?? "postgres://sigdata:sigdata@localhost:5434/postgres";
const TEST_DB = "sigdata_test";
const testUrl = () => {
  const url = new URL(ADMIN_URL);
  url.pathname = `/${TEST_DB}`;
  return url.toString();
};

const prepareDatabase = async () => {
  const admin = new Client({ connectionString: ADMIN_URL, connectionTimeoutMillis: 2000 });
  try {
    await admin.connect();
  } catch {
    return false;
  }
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${TEST_DB}`);
  } finally {
    await admin.end();
  }
  const pool = new Pool({ connectionString: testUrl() });
  await migrate(drizzle(pool), { migrationsFolder: path.resolve("drizzle") });
  await pool.end();
  return true;
};

const available = await prepareDatabase();

describe("API com banco real", { skip: available ? false : "Postgres de teste indisponível" }, () => {
  type Api = typeof import("../src/app");
  type Db = typeof import("../src/db");
  let app: Api["app"];
  let dbModule: Db;

  before(async () => {
    process.env.DATABASE_URL = testUrl();
    ({ app } = await import("../src/app"));
    dbModule = await import("../src/db");
  });

  after(async () => {
    await dbModule?.db.$client.end();
  });

  const request = (cookie: string | null, method: string, url: string, body?: unknown) =>
    app.request(url, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        origin: "http://localhost:3000",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  const signUp = async (email: string) => {
    const res = await request(null, "POST", "/api/auth/sign-up/email", {
      name: "Teste",
      email,
      password: "senha-de-teste-123",
    });
    assert.equal(res.status, 200, await res.clone().text());
    return res.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
  };

  test("rotas de dados exigem sessão", async () => {
    for (const url of ["/api/projects", "/api/dashboards", "/api/sources"]) {
      assert.equal((await request(null, "GET", url)).status, 401, url);
    }
  });

  test("respostas trazem cabeçalhos de segurança", async () => {
    const res = await request(null, "GET", "/api/health");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  });

  test("um usuário não enxerga nem altera dados de outro", async () => {
    const alice = await signUp("alice@teste.dev");
    const bruno = await signUp("bruno@teste.dev");

    const created = await request(alice, "POST", "/api/projects", { title: "Projeto da Alice" });
    assert.equal(created.status, 200);
    const project = (await created.json()) as { id: string };

    assert.equal((await request(bruno, "GET", `/api/projects/${project.id}`)).status, 404);
    assert.equal((await request(bruno, "PATCH", `/api/projects/${project.id}`, { title: "invadido" })).status, 404);
    assert.equal((await request(bruno, "DELETE", `/api/projects/${project.id}`)).status, 404);
    const list = (await (await request(bruno, "GET", "/api/projects")).json()) as { id: string }[];
    assert.ok(!list.some((entry) => entry.id === project.id));

    const aliceProject = await request(alice, "GET", `/api/projects/${project.id}`);
    assert.equal(aliceProject.status, 200, "o dono continua com acesso");

    const dashboards = (await (await request(alice, "GET", "/api/dashboards")).json()) as { id: string }[];
    assert.ok(dashboards.length > 0, "conta nova recebe dashboards de exemplo");
    const target = dashboards[0]!.id;
    assert.equal((await request(bruno, "GET", `/api/dashboards/${target}/share`)).status, 404);
    assert.equal((await request(bruno, "POST", `/api/dashboards/${target}/share`, {})).status, 404);
  });

  test("link público: expira, não vaza o token e pode ser revogado", async () => {
    const dono = await signUp("dono@teste.dev");
    const [dashboard] = (await (await request(dono, "GET", "/api/dashboards")).json()) as { id: string }[];
    const id = dashboard!.id;

    const shared = (await (await request(dono, "POST", `/api/dashboards/${id}/share`, { expiresInDays: 7 })).json()) as {
      token: string;
      expiresAt: number;
    };
    assert.ok(shared.expiresAt > Date.now());

    const open = await request(null, "GET", `/api/public/dashboards/${shared.token}`);
    assert.equal(open.status, 200);
    assert.ok(!JSON.stringify(await open.json()).includes(shared.token), "o token não volta no corpo");

    const { db, schema } = dbModule;
    const { eq } = await import("drizzle-orm");
    await db
      .update(schema.dashboards)
      .set({ sharedExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.dashboards.id, id));
    assert.equal((await request(null, "GET", `/api/public/dashboards/${shared.token}`)).status, 410);

    // novo compartilhamento gera outro token; o expirado não volta a valer
    const renewed = (await (await request(dono, "POST", `/api/dashboards/${id}/share`, {})).json()) as { token: string };
    assert.notEqual(renewed.token, shared.token);
    assert.equal((await request(null, "GET", `/api/public/dashboards/${renewed.token}`)).status, 200);

    await request(dono, "DELETE", `/api/dashboards/${id}/share`);
    assert.equal((await request(null, "GET", `/api/public/dashboards/${renewed.token}`)).status, 404);
  });
});
