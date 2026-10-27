import "server-only";
import { headers } from "next/headers";
import type { z } from "zod";
import { auth } from "./auth";

/** Erro com status HTTP, convertido em resposta JSON por `handle`. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = "Recurso", genero: "o" | "a" = "o") =>
  new HttpError(404, `${what} não encontrad${genero}.`);

export type CurrentUser = { id: string; name: string; email: string };

/** Usuário da sessão atual ou 401. Toda rota de dados passa por aqui. */
export const requireUser = async (): Promise<CurrentUser> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new HttpError(401, "Sessão expirada. Entre novamente.");
  const { id, name, email } = session.user;
  return { id, name, email };
};

export const parseBody = async <T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> => {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Corpo da requisição inválido (JSON esperado).");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".");
    throw new HttpError(400, `Dados inválidos${path ? ` em "${path}"` : ""}: ${issue?.message}`);
  }
  return parsed.data;
};

type Ctx<P> = { params: Promise<P> };

/**
 * Envolve um handler de rota: injeta usuário autenticado, converte erros em JSON
 * e evita vazar detalhes internos em erros inesperados.
 */
export const handle =
  <P = Record<string, string>>(
    fn: (args: { req: Request; user: CurrentUser; params: P }) => Promise<Response | unknown>,
  ) =>
  async (req: Request, ctx: Ctx<P>) => {
    try {
      const user = await requireUser();
      const params = ctx?.params ? await ctx.params : ({} as P);
      const out = await fn({ req, user, params });
      if (out instanceof Response) return out;
      return Response.json(out ?? { ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  };

export const errorResponse = (error: unknown) => {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error("[sigdata] erro na API", error);
  return Response.json({ error: "Erro interno no servidor." }, { status: 500 });
};
