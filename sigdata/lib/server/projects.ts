import "server-only";
import { and, eq } from "drizzle-orm";
import type { Notebook } from "@/lib/notebooks/store";
import { db, schema } from "./db";
import { notFound } from "./http";

type ProjectRow = typeof schema.projects.$inferSelect;

export const toNotebook = (row: ProjectRow): Notebook => ({
  id: row.id,
  title: row.title,
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt.getTime(),
  coverIndex: row.coverIndex,
  sourceId: row.sourceId,
  sourceCount: row.sourceId ? 1 : 0,
});

export const getProject = async (userId: string, id: string) => {
  const [row] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId)));
  if (!row) throw notFound("Projeto");
  return row;
};
