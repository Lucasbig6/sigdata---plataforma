import type { Context } from "hono";
import type { z } from "zod";
import { auth } from "./auth";

/** Erro com status HTTP, convertido em resposta JSON por `handle`. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const notFound = (what = "Recurso", genero: "o" | "a" = "o") =>
  new HttpError(404, `${what} não encontrad${genero}.`);

export type CurrentUser = { id: string; name: string; email: string };

/** Usuário da sessão atual ou 401. Toda rota de dados passa por aqui. */
export const requireUser = async (headers: Headers): Promise<CurrentUser> => {
  const session = await auth.api.getSession({ headers });
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

export const errorResponse = (error: unknown) => {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error("[sigdata] erro na API", error);
  return Response.json({ error: "Erro interno no servidor." }, { status: 500 });
};

type HandlerArgs<P> = { req: Request; user: CurrentUser; params: P; c: Context };

/**
 * Envolve um handler: exige usuário autenticado, converte o retorno em JSON e
 * erros em respostas com status adequado (sem vazar detalhes internos).
 */
export const handle =
  <P extends Record<string, string> = Record<string, string>>(
    fn: (args: HandlerArgs<P>) => Promise<Response | unknown>,
  ) =>
  async (c: Context) => {
    try {
      const user = await requireUser(c.req.raw.headers);
      const out = await fn({ req: c.req.raw, user, params: c.req.param() as P, c });
      if (out instanceof Response) return out;
      return Response.json(out ?? { ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  };
