import { handle, parseBody } from "@/lib/server/http";
import { postgresConnectionSchema } from "@/lib/server/sources/schemas";
import { testPostgres } from "@/lib/server/sources/service";

export const POST = handle(async ({ req }) => testPostgres(await parseBody(req, postgresConnectionSchema)));
