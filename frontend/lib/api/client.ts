/**
 * Cliente HTTP da API do SIGDATA (lado do navegador).
 * Erros viram `ApiError` com a mensagem em português vinda do servidor;
 * 401 leva para o login preservando a página atual.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const redirectToLogin = () => {
  if (typeof window === "undefined" || window.location.pathname.startsWith("/login")) return;
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
};

export const api = async <T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> => {
  const { json, headers, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    headers: json !== undefined ? { "content-type": "application/json", ...headers } : headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: "same-origin",
  });
  if (res.status === 401) redirectToLogin();
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    // resposta que não é JSON (ex.: proxy sem o backend, durante um reinício)
    throw new ApiError(
      res.status,
      res.status >= 500
        ? "Servidor indisponível no momento. Tente novamente em instantes."
        : `Resposta inesperada do servidor (HTTP ${res.status}).`,
    );
  }
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Falha na requisição (HTTP ${res.status}).`;
    throw new ApiError(res.status, message);
  }
  return data as T;
};

/** Para mutações disparadas em segundo plano: registra o erro sem quebrar a interface. */
export const background = (promise: Promise<unknown>, what: string) => {
  promise.catch((error: unknown) => {
    console.error(`[sigdata] ${what}:`, error);
  });
};
