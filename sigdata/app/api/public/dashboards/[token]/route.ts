import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/server/db";
import { analysesForDashboard, toDashboard } from "@/lib/server/dashboards";
import { errorResponse, notFound } from "@/lib/server/http";

/** Rota pública (sem login): só responde a tokens de compartilhamento válidos. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
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
}
