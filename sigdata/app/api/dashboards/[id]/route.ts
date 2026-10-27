import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/server/db";
import { getDashboardRow, parseDashboard, toDashboard } from "@/lib/server/dashboards";
import { handle } from "@/lib/server/http";

type Params = { id: string };

export const GET = handle<Params>(async ({ user, params }) =>
  toDashboard(await getDashboardRow(user.id, params.id)),
);

export const PUT = handle<Params>(async ({ req, user, params }) => {
  const existing = await getDashboardRow(user.id, params.id);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const doc = parseDashboard({ ...body, id: existing.id });
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
});

export const DELETE = handle<Params>(async ({ user, params }) => {
  const existing = await getDashboardRow(user.id, params.id);
  await db.delete(schema.dashboards).where(eq(schema.dashboards.id, existing.id));
  return { ok: true };
});
