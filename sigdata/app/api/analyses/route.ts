import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { AnalysisSnapshot } from "@/lib/dashboards/analyses";
import { db, schema } from "@/lib/server/db";
import { toSavedAnalysis } from "@/lib/server/dashboards";
import { handle, HttpError, parseBody } from "@/lib/server/http";

export const GET = handle(async ({ user }) => {
  const rows = await db
    .select()
    .from(schema.analyses)
    .where(eq(schema.analyses.userId, user.id))
    .orderBy(desc(schema.analyses.savedAt))
    .limit(200);
  return rows.map(toSavedAnalysis);
});

const bodySchema = z.object({
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

export const POST = handle(async ({ req, user }) => {
  const body = await parseBody(req, bodySchema);
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
});
