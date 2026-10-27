import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { DEFAULT_NOTEBOOK_TITLE } from "@/lib/notebooks/store";
import { db, schema } from "@/lib/server/db";
import { handle, HttpError, parseBody } from "@/lib/server/http";
import { toNotebook } from "@/lib/server/projects";

export const GET = handle(async ({ user }) => {
  const rows = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.userId, user.id))
    .orderBy(desc(schema.projects.updatedAt));
  return rows.map(toNotebook);
});

const createSchema = z.object({
  // id gerado no cliente (navegação imediata para o workspace)
  id: z.uuid().optional(),
  title: z.string().max(200).optional(),
  coverIndex: z.number().int().min(0).max(31).optional(),
});

export const POST = handle(async ({ req, user }) => {
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
});
