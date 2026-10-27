import { handle, HttpError, parseBody } from "@/lib/server/http";
import { createPostgresSchema } from "@/lib/server/sources/schemas";
import { createFromUpload, createPostgres, listSources } from "@/lib/server/sources/service";

export const GET = handle(async ({ user }) => listSources(user.id));

/** multipart (arquivo CSV/XLSX) ou JSON (conexão Postgres). */
export const POST = handle(async ({ req, user }) => {
  const type = req.headers.get("content-type") ?? "";
  if (type.startsWith("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Envie um arquivo no campo \"file\".");
    return createFromUpload(user.id, {
      file,
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
    });
  }
  const body = await parseBody(req, createPostgresSchema);
  return createPostgres(user.id, body);
});
