import { z } from "zod";
import { handle, parseBody } from "@/lib/server/http";
import { getProject } from "@/lib/server/projects";
import { runQuery } from "@/lib/server/sources/service";

const bodySchema = z.object({
  sql: z.string().min(1).max(20_000),
  title: z.string().max(160).default("Consulta manual"),
  projectId: z.string().nullable().optional(),
});

export const POST = handle<{ id: string }>(async ({ req, user, params }) => {
  const body = await parseBody(req, bodySchema);
  if (body.projectId) await getProject(user.id, body.projectId);
  return runQuery(user.id, { ...body, sourceId: params.id });
});
