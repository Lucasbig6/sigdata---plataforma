import { asc, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { UIMessage } from "ai";
import { DEFAULT_NOTEBOOK_TITLE } from "@shared/notebook";
import { WIDGET_KINDS, type PanelWidget } from "@shared/panel";
import { db, schema } from "../db";
import { handle, HttpError, parseBody } from "../http";
import { getProject, toNotebook } from "../projects";
import { getSourceRow } from "../sources/service";

export const projectsRoutes = new Hono();

projectsRoutes.get(
  "/",
  handle(async ({ user }) => {
    const rows = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.userId, user.id))
      .orderBy(desc(schema.projects.updatedAt));
    return rows.map(toNotebook);
  }),
);

const createSchema = z.object({
  // id gerado no cliente (navegação imediata para o workspace)
  id: z.uuid().optional(),
  title: z.string().max(200).optional(),
  coverIndex: z.number().int().min(0).max(31).optional(),
});

projectsRoutes.post(
  "/",
  handle(async ({ req, user }) => {
    const body = await parseBody(req, createSchema);
    const [row] = await db
      .insert(schema.projects)
      .values({
        id: body.id ?? crypto.randomUUID(),
        userId: user.id,
        title: body.title?.trim() || DEFAULT_NOTEBOOK_TITLE,
        coverIndex: body.coverIndex ?? 0,
      })
      .onConflictDoNothing()
      .returning();
    if (!row) throw new HttpError(409, "Já existe um projeto com este id.");
    return toNotebook(row);
  }),
);

projectsRoutes.get(
  "/:id",
  handle<{ id: string }>(async ({ user, params }) => toNotebook(await getProject(user.id, params.id))),
);

const patchSchema = z.object({
  title: z.string().max(200).optional(),
  sourceId: z.string().nullable().optional(),
});

projectsRoutes.patch(
  "/:id",
  handle<{ id: string }>(async ({ req, user, params }) => {
    const project = await getProject(user.id, params.id);
    const body = await parseBody(req, patchSchema);
    if (body.sourceId) await getSourceRow(user.id, body.sourceId);
    const [row] = await db
      .update(schema.projects)
      .set({
        ...(body.title !== undefined && { title: body.title.trim() || DEFAULT_NOTEBOOK_TITLE }),
        ...(body.sourceId !== undefined && { sourceId: body.sourceId }),
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, project.id))
      .returning();
    return toNotebook(row);
  }),
);

projectsRoutes.delete(
  "/:id",
  handle<{ id: string }>(async ({ user, params }) => {
    const project = await getProject(user.id, params.id);
    await db.delete(schema.projects).where(eq(schema.projects.id, project.id));
    return { ok: true };
  }),
);

/* -------------------------------------------------------------- mensagens */

projectsRoutes.get(
  "/:id/messages",
  handle<{ id: string }>(async ({ user, params }) => {
    const project = await getProject(user.id, params.id);
    const rows = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.projectId, project.id))
      .orderBy(asc(schema.messages.position));
    return rows.map(
      (row) =>
        ({
          id: row.id,
          role: row.role,
          parts: row.parts,
          ...(row.metadata != null && { metadata: row.metadata }),
        }) as UIMessage,
    );
  }),
);

/* ------------------------------------------------------------------ painel */

const finite = z.number().refine(Number.isFinite);

const widgetSchema = z
  .object({
    id: z.string().min(1).max(64),
    kind: z.enum(WIDGET_KINDS),
    title: z.string().max(200),
    x: finite,
    y: finite,
    w: finite,
    h: finite,
    z: finite,
    resultId: z.string().optional(),
  })
  .loose();

const panelSchema = z.object({ widgets: z.array(widgetSchema).max(40) });

projectsRoutes.get(
  "/:id/panel",
  handle<{ id: string }>(async ({ user, params }) => {
    const project = await getProject(user.id, params.id);
    const [row] = await db
      .select()
      .from(schema.projectPanels)
      .where(eq(schema.projectPanels.projectId, project.id));
    return { widgets: row?.widgets ?? [] };
  }),
);

projectsRoutes.put(
  "/:id/panel",
  handle<{ id: string }>(async ({ req, user, params }) => {
    const project = await getProject(user.id, params.id);
    const { widgets } = await parseBody(req, panelSchema);
    if (JSON.stringify(widgets).length > 2_000_000) throw new HttpError(413, "Painel grande demais.");
    const value = widgets as PanelWidget[];
    await db
      .insert(schema.projectPanels)
      .values({ projectId: project.id, widgets: value })
      .onConflictDoUpdate({
        target: schema.projectPanels.projectId,
        set: { widgets: value, updatedAt: new Date() },
      });
    return { ok: true };
  }),
);
