import { randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AnalysisSnapshot } from "@shared/analyses";
import { db, schema } from "../db";
import {
  analysesForDashboard,
  getDashboardRow,
  parseDashboard,
  toDashboard,
  toSavedAnalysis,
} from "../dashboards";
import { errorResponse, handle, HttpError, notFound, parseBody } from "../http";

const readJson = (req: Request) => req.json().catch(() => null) as Promise<Record<string, unknown> | null>;

/* -------------------------------------------------------------- dashboards */

export const dashboardsRoutes = new Hono();

dashboardsRoutes.get(
  "/",
  handle(async ({ user }) => {
    const rows = await db
      .select()
      .from(schema.dashboards)
      .where(eq(schema.dashboards.userId, user.id))
      .orderBy(desc(schema.dashboards.updatedAt));
    return rows.map(toDashboard);
  }),
);

dashboardsRoutes.post(
  "/",
  handle(async ({ req, user }) => {
    const doc = parseDashboard(await readJson(req));
    const [row] = await db
      .insert(schema.dashboards)
      .values({
        id: doc.id,
        userId: user.id,
        name: doc.name.trim() || "Novo dashboard",
        description: doc.description,
        origin: "user",
        doc: { schemaVersion: doc.schemaVersion, canvas: doc.canvas, elements: doc.elements },
      })
      .onConflictDoNothing()
      .returning();
    if (!row) throw new HttpError(409, "Já existe um dashboard com este id.");
    return toDashboard(row);
  }),
);

dashboardsRoutes.get(
  "/:id",
  handle<{ id: string }>(async ({ user, params }) => toDashboard(await getDashboardRow(user.id, params.id))),
);

dashboardsRoutes.put(
  "/:id",
  handle<{ id: string }>(async ({ req, user, params }) => {
    const existing = await getDashboardRow(user.id, params.id);
    const doc = parseDashboard({ ...(await readJson(req)), id: existing.id });
    const [row] = await db
      .update(schema.dashboards)
      .set({
        name: doc.name.trim() || "Dashboard sem nome",
        description: doc.description,
        doc: { schemaVersion: doc.schemaVersion, canvas: doc.canvas, elements: doc.elements },
        updatedAt: new Date(),
      })
      .where(eq(schema.dashboards.id, existing.id))
      .returning();
    return toDashboard(row);
  }),
);

dashboardsRoutes.delete(
  "/:id",
  handle<{ id: string }>(async ({ user, params }) => {
    const existing = await getDashboardRow(user.id, params.id);
    await db.delete(schema.dashboards).where(eq(schema.dashboards.id, existing.id));
    return { ok: true };
  }),
);

/** Gera (ou devolve) o link público somente-leitura. */
dashboardsRoutes.post(
  "/:id/share",
  handle<{ id: string }>(async ({ user, params }) => {
    const row = await getDashboardRow(user.id, params.id);
    if (row.shareToken) return { token: row.shareToken };
    const token = randomBytes(18).toString("base64url");
    await db
      .update(schema.dashboards)
      .set({ shareToken: token, sharedAt: new Date() })
      .where(eq(schema.dashboards.id, row.id));
    return { token };
  }),
);

/** Revoga o link: o token antigo deixa de funcionar imediatamente. */
dashboardsRoutes.delete(
  "/:id/share",
  handle<{ id: string }>(async ({ user, params }) => {
    const row = await getDashboardRow(user.id, params.id);
    await db
      .update(schema.dashboards)
      .set({ shareToken: null, sharedAt: null })
      .where(eq(schema.dashboards.id, row.id));
    return { ok: true };
  }),
);

/* ---------------------------------------------------------------- públicas */

export const publicRoutes = new Hono();

/** Sem login: só responde a tokens de compartilhamento válidos. */
publicRoutes.get("/dashboards/:token", async (c) => {
  try {
    const token = c.req.param("token");
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) throw notFound("Link");
    const [row] = await db
      .select()
      .from(schema.dashboards)
      .where(eq(schema.dashboards.shareToken, token));
    if (!row) throw notFound("Link");
    const { shareToken: _omit, ...dashboard } = toDashboard(row);
    return Response.json({ dashboard, analyses: await analysesForDashboard(row) });
  } catch (error) {
    return errorResponse(error);
  }
});

/* ---------------------------------------------------------------- análises */

export const analysesRoutes = new Hono();

analysesRoutes.get(
  "/",
  handle(async ({ user }) => {
    const rows = await db
      .select()
      .from(schema.analyses)
      .where(eq(schema.analyses.userId, user.id))
      .orderBy(desc(schema.analyses.savedAt))
      .limit(200);
    return rows.map(toSavedAnalysis);
  }),
);

const analysisSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().max(200),
  snapshot: z.object({
    kpis: z.array(z.unknown()).max(50),
    serie: z.array(z.unknown()).max(5000),
    municipios: z.array(z.unknown()).max(5000),
    resumos: z.array(z.unknown()).max(50),
    tabela: z
      .object({
        columns: z.array(z.string()).max(100),
        rows: z.array(z.record(z.string(), z.unknown())).max(5000),
      })
      .optional(),
  }),
});

analysesRoutes.post(
  "/",
  handle(async ({ req, user }) => {
    const body = await parseBody(req, analysisSchema);
    const snapshot = body.snapshot as AnalysisSnapshot;
    const title = body.title.trim() || "Análise sem título";
    const [row] = await db
      .insert(schema.analyses)
      .values({ id: body.id, userId: user.id, title, snapshot })
      .onConflictDoUpdate({
        target: schema.analyses.id,
        set: { title, snapshot, savedAt: new Date() },
        // só atualiza se a análise for do próprio usuário
        setWhere: eq(schema.analyses.userId, user.id),
      })
      .returning();
    if (!row) throw new HttpError(409, "Id de análise já utilizado.");
    return toSavedAnalysis(row);
  }),
);
