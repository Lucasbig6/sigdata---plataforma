import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/server/db";
import { getDashboardRow } from "@/lib/server/dashboards";
import { handle } from "@/lib/server/http";

type Params = { id: string };

/** Gera (ou devolve) o link público somente-leitura. */
export const POST = handle<Params>(async ({ user, params }) => {
  const row = await getDashboardRow(user.id, params.id);
  if (row.shareToken) return { token: row.shareToken };
  const token = randomBytes(18).toString("base64url");
  await db
    .update(schema.dashboards)
    .set({ shareToken: token, sharedAt: new Date() })
    .where(eq(schema.dashboards.id, row.id));
  return { token };
});

/** Revoga o link: o token antigo deixa de funcionar imediatamente. */
export const DELETE = handle<Params>(async ({ user, params }) => {
  const row = await getDashboardRow(user.id, params.id);
  await db
    .update(schema.dashboards)
    .set({ shareToken: null, sharedAt: null })
    .where(eq(schema.dashboards.id, row.id));
  return { ok: true };
});
