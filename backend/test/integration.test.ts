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

  describe("papéis", () => {
    const setRole = async (email: string, role: "usuario" | "analista" | "admin") => {
      const { db, schema } = dbModule;
      const { eq } = await import("drizzle-orm");
      await db.update(schema.user).set({ role }).where(eq(schema.user.email, email));
    };

    test("cadastro novo entra como usuário e não escolhe o próprio papel", async () => {
      const res = await request(null, "POST", "/api/auth/sign-up/email", {
        name: "Tentativa",
        email: "tentativa@teste.dev",
        password: "senha-de-teste-123",
        role: "admin",
      });
      const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
      const session = (await (await request(cookie, "GET", "/api/auth/get-session")).json()) as {
        user: { role: string };
      };
      assert.equal(session.user.role, "usuario");
    });

    test("usuário comum não importa fontes, não usa o editor SQL e não vê a tela de admin", async () => {
      const comum = await signUp("comum@teste.dev");
      assert.equal((await request(comum, "POST", "/api/sources/test", { host: "x", database: "d", user: "u" })).status, 403);
      assert.equal((await request(comum, "POST", "/api/sources/dataset", { sourceId: "x", sql: "select 1", name: "n" })).status, 403);
      assert.equal((await request(comum, "POST", "/api/sources/qualquer/run", { sql: "select 1" })).status, 403);
      assert.equal((await request(comum, "GET", "/api/admin/users")).status, 403);
    });

    test("analista publica dataset; usuário o enxerga e usa, mas não gerencia", async () => {
      const analista = await signUp("analista@teste.dev");
      await setRole("analista@teste.dev", "analista");
      const comum = await signUp("comum2@teste.dev");

      const sources = (await (await request(analista, "GET", "/api/sources")).json()) as { id: string; kind: string }[];
      const demo = sources.find((source) => source.kind === "demo");
      assert.ok(demo);
      const created = await request(analista, "POST", "/api/sources/dataset", {
        sourceId: demo.id,
        sql: "SELECT * FROM municipios",
        name: "Municípios tratados",
      });
      assert.equal(created.status, 200, await created.clone().text());
      const dataset = (await created.json()) as { id: string; tables: { name: string }[]; published: boolean };
      assert.equal(dataset.published, false);

      const listBefore = (await (await request(comum, "GET", "/api/sources")).json()) as { id: string }[];
      assert.ok(!listBefore.some((source) => source.id === dataset.id), "rascunho não aparece");
      assert.equal((await request(comum, "GET", `/api/sources/${dataset.id}`)).status, 404);

      assert.equal((await request(comum, "POST", `/api/sources/${dataset.id}/publish`, { published: true })).status, 403);
      const published = await request(analista, "POST", `/api/sources/${dataset.id}/publish`, { published: true });
      assert.equal(published.status, 200);

      const listAfter = (await (await request(comum, "GET", "/api/sources")).json()) as { id: string }[];
      assert.ok(listAfter.some((source) => source.id === dataset.id), "publicado aparece");
      const table = encodeURIComponent(dataset.tables[0]!.name);
      assert.equal((await request(comum, "GET", `/api/sources/${dataset.id}/preview?table=${table}`)).status, 200);
      assert.equal((await request(comum, "DELETE", `/api/sources/${dataset.id}`)).status, 403);

      // retirar da publicação esconde de novo
      await request(analista, "POST", `/api/sources/${dataset.id}/publish`, { published: false });
      assert.equal((await request(comum, "GET", `/api/sources/${dataset.id}`)).status, 404);
    });

    test("admin altera papéis e não pode ficar sem administrador", async () => {
      const { db, schema } = dbModule;
      const { eq } = await import("drizzle-orm");
      await db.update(schema.user).set({ role: "usuario" }).where(eq(schema.user.role, "admin"));
      const admin = await signUp("admin@teste.dev");
      await setRole("admin@teste.dev", "admin");

      const users = (await (await request(admin, "GET", "/api/admin/users")).json()) as { id: string; email: string; role: string }[];
      const self = users.find((entry) => entry.email === "admin@teste.dev")!;
      const other = users.find((entry) => entry.email === "comum2@teste.dev")!;

      const withDashboards = users.find((entry) => entry.email === "alice@teste.dev") as unknown as { dashboards: number };
      assert.ok(withDashboards.dashboards >= 3, "contagens por pessoa refletem os dashboards de exemplo");

      assert.equal((await request(admin, "PATCH", `/api/admin/users/${other.id}`, { role: "analista" })).status, 200);
      assert.equal((await request(admin, "PATCH", `/api/admin/users/${other.id}`, { role: "super" })).status, 400);
      assert.equal((await request(admin, "PATCH", `/api/admin/users/${self.id}`, { role: "usuario" })).status, 409);
    });

    test("admin cria conta com link de acesso; cadastro fechado barra o autocadastro", async () => {
      const admin = await signUp("admin2@teste.dev");
      await setRole("admin2@teste.dev", "admin");

      const created = await request(admin, "POST", "/api/admin/users", {
        name: "Convidada",
        email: "Convidada@Teste.dev",
        role: "analista",
      });
      assert.equal(created.status, 200, await created.clone().text());
      const body = (await created.json()) as { id: string; role: string; accessLink: string | null };
      assert.equal(body.role, "analista");
      assert.ok(body.accessLink?.includes("token") || body.accessLink?.includes("reset-password"), "devolve o link de acesso");
      assert.equal((await request(admin, "POST", "/api/admin/users", { name: "x", email: "convidada@teste.dev" })).status, 409);

      // a conta criada tem o perfil escolhido e recebeu o conteúdo inicial
      const users = (await (await request(admin, "GET", "/api/admin/users")).json()) as { email: string; role: string; dashboards: number }[];
      const row = users.find((entry) => entry.email === "convidada@teste.dev");
      assert.equal(row?.role, "analista");
      assert.ok((row?.dashboards ?? 0) >= 3);

      const comum = await signUp("comum3@teste.dev");
      assert.equal((await request(comum, "POST", "/api/admin/users", { name: "x", email: "x@teste.dev" })).status, 403);
      assert.equal((await request(comum, "POST", `/api/admin/users/${body.id}/access-link`)).status, 403);
      const again = (await (await request(admin, "POST", `/api/admin/users/${body.id}/access-link`)).json()) as { accessLink: string | null };
      assert.ok(again.accessLink);

      process.env.SIGDATA_OPEN_SIGNUP = "false";
      try {
        const config = (await (await request(null, "GET", "/api/config")).json()) as { openSignup: boolean };
        assert.equal(config.openSignup, false);
        const blocked = await request(null, "POST", "/api/auth/sign-up/email", {
          name: "Intrusa",
          email: "intrusa@teste.dev",
          password: "senha-de-teste-123",
        });
        assert.notEqual(blocked.status, 200);
        const stillAdmin = await request(admin, "POST", "/api/admin/users", { name: "Outra", email: "outra@teste.dev" });
        assert.equal(stillAdmin.status, 200, "o admin continua criando contas com o cadastro fechado");
      } finally {
        process.env.SIGDATA_OPEN_SIGNUP = "true";
      }
    });

    test("admin desativa, reativa e remove contas; datasets publicados passam para ele", async () => {
      const admin = await signUp("admin3@teste.dev");
      await setRole("admin3@teste.dev", "admin");
      const analista = await signUp("analista3@teste.dev");
      await setRole("analista3@teste.dev", "analista");
      const list = async () =>
        (await (await request(admin, "GET", "/api/admin/users")).json()) as { id: string; email: string; disabled: boolean }[];
      const target = (await list()).find((entry) => entry.email === "analista3@teste.dev")!;

      // dataset publicado do analista sobrevive à remoção
      const sources = (await (await request(analista, "GET", "/api/sources")).json()) as { id: string; kind: string }[];
      const demo = sources.find((source) => source.kind === "demo")!;
      const dataset = (await (
        await request(analista, "POST", "/api/sources/dataset", { sourceId: demo.id, sql: "SELECT * FROM municipios", name: "Herdado" })
      ).json()) as { id: string };
      await request(analista, "POST", `/api/sources/${dataset.id}/publish`, { published: true });

      assert.equal((await request(admin, "PATCH", `/api/admin/users/${target.id}`, { disabled: true })).status, 200);
      assert.ok([401, 403].includes((await request(analista, "GET", "/api/projects")).status), "sessão antiga deixa de valer");
      const login = await request(null, "POST", "/api/auth/sign-in/email", { email: "analista3@teste.dev", password: "senha-de-teste-123" });
      assert.notEqual(login.status, 200, "conta desativada não entra");

      assert.equal((await request(admin, "PATCH", `/api/admin/users/${target.id}`, { disabled: false })).status, 200);
      const again = await request(null, "POST", "/api/auth/sign-in/email", { email: "analista3@teste.dev", password: "senha-de-teste-123" });
      assert.equal(again.status, 200, "reativada, volta a entrar");

      const self = (await list()).find((entry) => entry.email === "admin3@teste.dev")!;
      assert.equal((await request(admin, "PATCH", `/api/admin/users/${self.id}`, { disabled: true })).status, 409);
      assert.equal((await request(admin, "DELETE", `/api/admin/users/${self.id}`)).status, 409);

      assert.equal((await request(admin, "DELETE", `/api/admin/users/${target.id}`)).status, 200);
      assert.ok(!(await list()).some((entry) => entry.email === "analista3@teste.dev"));
      const adminSources = (await (await request(admin, "GET", "/api/sources")).json()) as { id: string }[];
      assert.ok(adminSources.some((source) => source.id === dataset.id), "dataset publicado ficou com o admin");

      const audit = (await (await request(admin, "GET", "/api/admin/audit")).json()) as { action: string }[];
      for (const action of ["usuario.desativado", "usuario.reativado", "usuario.removido", "dataset.publicado"]) {
        assert.ok(audit.some((entry) => entry.action === action), `registrou ${action}`);
      }
    });

    test("despublicar ou excluir dataset em uso exige confirmação", async () => {
      const analista = await signUp("analista4@teste.dev");
      await setRole("analista4@teste.dev", "analista");
      const sources = (await (await request(analista, "GET", "/api/sources")).json()) as { id: string; kind: string }[];
      const demo = sources.find((source) => source.kind === "demo")!;
      const dataset = (await (
        await request(analista, "POST", "/api/sources/dataset", { sourceId: demo.id, sql: "SELECT * FROM municipios", name: "Em uso" })
      ).json()) as { id: string };
      await request(analista, "POST", `/api/sources/${dataset.id}/publish`, { published: true });

      const comum = await signUp("comum4@teste.dev");
      const project = (await (await request(comum, "POST", "/api/projects", { title: "Usa o dataset" })).json()) as { id: string };
      assert.equal((await request(comum, "PATCH", `/api/projects/${project.id}`, { sourceId: dataset.id })).status, 200);

      const usage = (await (await request(analista, "GET", `/api/sources/${dataset.id}/usage`)).json()) as {
        projects: number;
        people: number;
      };
      assert.equal(usage.projects, 1);
      assert.equal(usage.people, 1);

      assert.equal((await request(analista, "POST", `/api/sources/${dataset.id}/publish`, { published: false })).status, 409);
      assert.equal((await request(analista, "DELETE", `/api/sources/${dataset.id}`)).status, 409);
      assert.equal((await request(analista, "POST", `/api/sources/${dataset.id}/publish`, { published: false, force: true })).status, 200);
    });

    test("dashboard compartilhado com pessoas logadas: só quem foi incluído vê", async () => {
      const dona = await signUp("dona5@teste.dev");
      const convidado = await signUp("convidado5@teste.dev");
      const fora = await signUp("fora5@teste.dev");
      const [dashboard] = (await (await request(dona, "GET", "/api/dashboards")).json()) as { id: string }[];
      const id = dashboard!.id;

      assert.equal((await request(convidado, "GET", `/api/dashboards/${id}/view`)).status, 404);
      const bad = await request(dona, "PUT", `/api/dashboards/${id}/access`, { sharedWithAll: false, emails: ["ninguem@teste.dev"] });
      assert.equal(bad.status, 422);

      const ok = await request(dona, "PUT", `/api/dashboards/${id}/access`, { sharedWithAll: false, emails: ["convidado5@teste.dev"] });
      assert.equal(ok.status, 200);

      const shared = (await (await request(convidado, "GET", "/api/dashboards/shared")).json()) as { id: string; ownerName: string }[];
      assert.ok(shared.some((entry) => entry.id === id));
      const view = await request(convidado, "GET", `/api/dashboards/${id}/view`);
      assert.equal(view.status, 200);
      assert.ok(!JSON.stringify(await view.json()).includes("shareToken"));
      assert.equal((await request(fora, "GET", `/api/dashboards/${id}/view`)).status, 404);
      assert.equal((await request(null, "GET", `/api/dashboards/${id}/view`)).status, 401);
      // quem só vê não consegue editar
      assert.equal((await request(convidado, "PUT", `/api/dashboards/${id}`, {})).status, 404);
      assert.equal((await request(convidado, "PUT", `/api/dashboards/${id}/access`, { sharedWithAll: true, emails: [] })).status, 404);

      await request(dona, "PUT", `/api/dashboards/${id}/access`, { sharedWithAll: true, emails: [] });
      assert.equal((await request(fora, "GET", `/api/dashboards/${id}/view`)).status, 200, "compartilhado com todos");
    });
  });
});
