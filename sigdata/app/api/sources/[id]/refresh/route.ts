import { handle } from "@/lib/server/http";
import { refreshSource } from "@/lib/server/sources/service";

export const POST = handle<{ id: string }>(async ({ user, params }) => refreshSource(user.id, params.id));
