import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/server/db";
import { parseDashboard, toDashboard } from "@/lib/server/dashboards";
import { handle, HttpError } from "@/lib/server/http";

export const GET = handle(async ({ user }) => {
  const rows = await db
    .select()
    .from(schema.dashboards)
    .where(eq(schema.dashboards.userId, user.id))
    .orderBy(desc(schema.dashboards.updatedAt));
  return rows.map(toDashboard);
});

export const POST = handle(async ({ req, user }) => {
  const doc = parseDashboard(await req.json().catch(() => null));
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
});
