import { handle } from "@/lib/server/http";
import { getResult } from "@/lib/server/sources/service";

export const GET = handle<{ id: string }>(async ({ user, params }) => getResult(user.id, params.id));
