import { z } from "zod";
import { handle, parseBody } from "@/lib/server/http";
import { deleteSource, getSourceRow, toDataSource, updateSourceMeta } from "@/lib/server/sources/service";

type Params = { id: string };

export const GET = handle<Params>(async ({ user, params }) => toDataSource(await getSourceRow(user.id, params.id)));

const patchSchema = z.object({ name: z.string().max(120).optional(), description: z.string().max(500).optional() });

export const PATCH = handle<Params>(async ({ req, user, params }) =>
  updateSourceMeta(user.id, params.id, await parseBody(req, patchSchema)),
);

export const DELETE = handle<Params>(async ({ user, params }) => {
  await deleteSource(user.id, params.id);
  return { ok: true };
});
