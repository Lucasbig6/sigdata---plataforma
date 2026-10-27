import { asc, eq } from "drizzle-orm";
import type { UIMessage } from "ai";
import { db, schema } from "@/lib/server/db";
import { handle } from "@/lib/server/http";
import { getProject } from "@/lib/server/projects";

type Params = { id: string };

export const GET = handle<Params>(async ({ user, params }) => {
  const project = await getProject(user.id, params.id);
  const rows = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.projectId, project.id))
    .orderBy(asc(schema.messages.position));
  return rows.map(
    (row) =>
      ({
        id: row.id,
        role: row.role,
        parts: row.parts,
        ...(row.metadata != null && { metadata: row.metadata }),
      }) as UIMessage,
  );
});
