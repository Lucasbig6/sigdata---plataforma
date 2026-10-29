import "./env";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { auth } from "./auth";
import { errorResponse } from "./http";
import { adminRoutes } from "./routes/admin";
import { cellsRoutes } from "./routes/cells";
import { chatRoutes } from "./routes/chat";
import { analysesRoutes, dashboardsRoutes, publicRoutes } from "./routes/dashboards";
import { projectsRoutes } from "./routes/projects";
import { resultsRoutes, sourcesRoutes } from "./routes/sources";

/**
 * API do SIGDATA. O navegador chega aqui pelo frontend (rewrite de /api/* no
 * Next.js), então tudo roda na mesma origem e os cookies de sessão funcionam.
 */
const app = new Hono().basePath("/api");

app.use(logger());

app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));

app.route("/projects/:id/cells", cellsRoutes);
app.route("/projects", projectsRoutes);
app.route("/sources", sourcesRoutes);
app.route("/results", resultsRoutes);
app.route("/analyses", analysesRoutes);
app.route("/dashboards", dashboardsRoutes);
app.route("/public", publicRoutes);
app.route("/chat", chatRoutes);
app.route("/admin", adminRoutes);

app.get("/health", (c) => c.json({ ok: true }));

app.notFound((c) => c.json({ error: "Rota não encontrada." }, 404));
app.onError((error) => errorResponse(error));

const port = Number(process.env.PORT) || 4000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[sigdata] backend em http://localhost:${info.port}/api`);
});
