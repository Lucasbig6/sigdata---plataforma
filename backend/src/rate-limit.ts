import type { MiddlewareHandler } from "hono";

/**
 * Limite de requisições em janela fixa, em memória (uma instância do servidor).
 * Para várias instâncias, troque o `hits` por um armazenamento compartilhado (Redis).
 */

type Bucket = { count: number; resetAt: number };

export const createLimiter = (options: { windowMs: number; max: number }) => {
  const hits = new Map<string, Bucket>();

  return (key: string, now = Date.now()) => {
    const bucket = hits.get(key);
    if (!bucket || bucket.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      // varredura barata para a tabela não crescer sem limite
      if (hits.size > 10_000) {
        for (const [entry, value] of hits) if (value.resetAt <= now) hits.delete(entry);
      }
      return { allowed: true, retryAfterSec: 0 };
    }
    bucket.count += 1;
    return {
      allowed: bucket.count <= options.max,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  };
};

const clientIp = (headers: Headers) =>
  headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "desconhecido";

/** Middleware por IP (rotas públicas). */
export const rateLimitByIp = (options: { windowMs: number; max: number }): MiddlewareHandler => {
  const limiter = createLimiter(options);
  return async (c, next) => {
    const result = limiter(clientIp(c.req.raw.headers));
    if (!result.allowed) {
      c.header("Retry-After", String(result.retryAfterSec));
      return c.json({ error: "Muitas requisições. Tente novamente em instantes." }, 429);
    }
    await next();
  };
};

/** Limitador por chave arbitrária (ex.: id do usuário), para uso dentro de handlers. */
export const userLimiter = (options: { windowMs: number; max: number }) => {
  const limiter = createLimiter(options);
  return (key: string) => {
    const result = limiter(key);
    return result.allowed ? null : result.retryAfterSec;
  };
};
