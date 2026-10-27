import { handle, HttpError } from "@/lib/server/http";
import { previewTable } from "@/lib/server/sources/service";

export const GET = handle<{ id: string }>(async ({ req, user, params }) => {
  const table = new URL(req.url).searchParams.get("table");
  if (!table) throw new HttpError(400, "Informe ?table=");
  return previewTable(user.id, params.id, table);
});
