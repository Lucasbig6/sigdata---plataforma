import { eq } from "drizzle-orm";
import { z } from "zod";
import { DEFAULT_NOTEBOOK_TITLE } from "@/lib/notebooks/store";
import { db, schema } from "@/lib/server/db";
import { handle, parseBody } from "@/lib/server/http";
import { getProject, toNotebook } from "@/lib/server/projects";
import { getSourceRow } from "@/lib/server/sources/service";

type Params = { id: string };

export const GET = handle<Params>(async ({ user, params }) =>
  toNotebook(await getProject(user.id, params.id)),
);

const patchSchema = z.object({
  title: z.string().max(200).optional(),
  sourceId: z.string().nullable().optional(),
});

export const PATCH = handle<Params>(async ({ req, user, params }) => {
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
});

export const DELETE = handle<Params>(async ({ user, params }) => {
  const project = await getProject(user.id, params.id);
  await db.delete(schema.projects).where(eq(schema.projects.id, project.id));
  return { ok: true };
});
