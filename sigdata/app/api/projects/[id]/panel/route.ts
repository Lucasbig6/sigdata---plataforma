import { eq } from "drizzle-orm";
import { z } from "zod";
import type { PanelWidget } from "@/lib/panel/store";
import { db, schema } from "@/lib/server/db";
import { handle, parseBody } from "@/lib/server/http";
import { getProject } from "@/lib/server/projects";

type Params = { id: string };

const finite = z.number().refine(Number.isFinite);

const widgetSchema = z
  .object({
    id: z.string().min(1).max(64),
    kind: z.enum(["linha", "barras", "kpi", "tabela"]),
    title: z.string().max(200),
    x: finite,
    y: finite,
    w: finite,
    h: finite,
    z: finite,
    resultId: z.string().optional(),
  })
  .loose();

const putSchema = z.object({ widgets: z.array(widgetSchema).max(40) });

export const GET = handle<Params>(async ({ user, params }) => {
  const project = await getProject(user.id, params.id);
  const [row] = await db
    .select()
    .from(schema.projectPanels)
    .where(eq(schema.projectPanels.projectId, project.id));
  return { widgets: row?.widgets ?? [] };
});

export const PUT = handle<Params>(async ({ req, user, params }) => {
  const project = await getProject(user.id, params.id);
  const { widgets } = await parseBody(req, putSchema);
  if (JSON.stringify(widgets).length > 2_000_000) {
    return Response.json({ error: "Painel grande demais." }, { status: 413 });
  }
  await db
    .insert(schema.projectPanels)
    .values({ projectId: project.id, widgets: widgets as PanelWidget[] })
    .onConflictDoUpdate({
      target: schema.projectPanels.projectId,
      set: { widgets: widgets as PanelWidget[], updatedAt: new Date() },
    });
  return { ok: true };
});
