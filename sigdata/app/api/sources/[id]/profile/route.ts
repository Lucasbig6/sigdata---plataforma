import { handle, HttpError } from "@/lib/server/http";
import { profileTable } from "@/lib/server/sources/service";

export const GET = handle<{ id: string }>(async ({ req, user, params }) => {
  const table = new URL(req.url).searchParams.get("table");
  if (!table) throw new HttpError(400, "Informe ?table=");
  return profileTable(user.id, params.id, table);
});
