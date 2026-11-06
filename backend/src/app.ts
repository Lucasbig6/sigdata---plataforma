import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { sql } from "drizzle-orm";
import { openSignup } from "./access";
import { db, schema } from "./db";
import { rateLimitByIp } from "./rate-limit";
import { auth } from "./auth";
import { errorResponse } from "./http";
import { adminRoutes } from "./routes/admin";
import { chatRoutes } from "./routes/chat";
import { analysesRoutes, dashboardsRoutes, publicRoutes, viewerRoutes } from "./routes/dashboards";
import { projectsRoutes } from "./routes/projects";
import { prepRoutes } from "./routes/prep";
import { resultsRoutes, sourcesRoutes } from "./routes/sources";

/**
 * API do SIGDATA. O navegador chega aqui pelo frontend (rewrite de /api/* no
 * Next.js), então tudo roda na mesma origem e os cookies de sessão funcionam.
 */
export const app = new Hono().basePath("/api");

app.use(logger());
app.use(secureHeaders());

const tooLarge = (c: import("hono").Context) => c.json({ error: "Requisição grande demais." }, 413);
// JSON comum: 2 MB. O chat aceita anexos (30 MB) e o envio de fontes tem seu próprio limite (50 MB).
for (const path of ["/projects/*", "/dashboards/*", "/analyses/*", "/public/*", "/results/*"]) {
  app.use(path, bodyLimit({ maxSize: 2 * 1024 * 1024, onError: tooLarge }));
}
app.use("/chat/*", bodyLimit({ maxSize: 30 * 1024 * 1024, onError: tooLarge }));

// rotas públicas (link compartilhado) não têm sessão: limita por IP
app.use("/public/*", rateLimitByIp({ windowMs: 60_000, max: 120 }));

app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));

app.route("/projects", projectsRoutes);
app.route("/sources", sourcesRoutes);
app.route("/prep", prepRoutes);
app.route("/results", resultsRoutes);
app.route("/analyses", analysesRoutes);
// as rotas de leitura (/shared, /:id/view) vêm antes das do editor (/:id)
app.route("/dashboards", viewerRoutes);
app.route("/dashboards", dashboardsRoutes);
app.route("/public", publicRoutes);
app.route("/chat", chatRoutes);
app.route("/admin", adminRoutes);

/** Configuração pública que a tela de login precisa: o cadastro está aberto? (A primeira conta é sempre permitida.) */
app.get("/config", async (c) => {
  const [first] = await db.select({ id: schema.user.id }).from(schema.user).limit(1);
  return c.json({ openSignup: !first || openSignup() });
});

app.get("/health", (c) => c.json({ ok: true }));

/** Pronto para receber tráfego: confere o banco. */
app.get("/ready", async (c) => {
  try {
    await db.execute(sql`select 1`);
    return c.json({ ok: true });
  } catch {
    return c.json({ ok: false, error: "Banco indisponível." }, 503);
  }
});

app.notFound((c) => c.json({ error: "Rota não encontrada." }, 404));
app.onError((error) => errorResponse(error));
