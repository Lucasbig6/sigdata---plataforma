import http from "node:http";
import https from "node:https";
import { HttpError } from "../http";
import { resolveSafeHost, safeLookup } from "../net-guard";

/**
 * GET para endereços informados pelo usuário (API REST, Google Sheets). Cada conexão passa pela
 * checagem de rede interna (SSRF), os redirecionamentos são seguidos à mão (até 3, re-validados)
 * e o corpo tem teto de tamanho e de tempo.
 */
export const FETCH_MAX_BYTES = 25 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;

export type FetchedBody = { status: number; headers: http.IncomingHttpHeaders; body: Buffer; finalUrl: URL };

const once = async (url: URL, headers: Record<string, string>) => {
  // IP literal não passa pelo `lookup` do Node: confere aqui (o `lookup` cobre os nomes de host)
  await resolveSafeHost(url.hostname.replace(/^\[|\]$/g, ""));
  return request(url, headers);
};

const request = (url: URL, headers: Record<string, string>) =>
  new Promise<{ res: http.IncomingMessage; body: Buffer }>((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      { method: "GET", headers: { "user-agent": "sigdata", accept: "application/json, text/csv, */*", ...headers }, lookup: safeLookup as never },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > FETCH_MAX_BYTES) {
            req.destroy(new HttpError(413, `A resposta passou de ${FETCH_MAX_BYTES / 1024 / 1024} MB.`));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ res, body: Buffer.concat(chunks) }));
        res.on("error", reject);
      },
    );
    req.setTimeout(FETCH_TIMEOUT_MS, () => req.destroy(new HttpError(408, "O endereço demorou demais para responder.")));
    req.on("error", (error) =>
      reject(error instanceof HttpError ? error : new HttpError(422, `Não foi possível acessar o endereço: ${error.message}`)),
    );
    req.end();
  });

export const parseHttpUrl = (raw: string): URL => {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new HttpError(400, "Endereço inválido.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new HttpError(400, "Use um endereço http:// ou https://.");
  }
  if (url.username || url.password) throw new HttpError(400, "Não coloque usuário e senha no endereço; use os cabeçalhos.");
  return url;
};

export const safeGet = async (
  rawUrl: string,
  headers: Record<string, string> = {},
  allowRedirectHost: (host: string) => boolean = () => true,
): Promise<FetchedBody> => {
  let url = parseHttpUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const { res, body } = await once(url, headers);
    const status = res.statusCode ?? 0;
    const location = res.headers.location;
    if (status >= 300 && status < 400 && location) {
      const next = parseHttpUrl(new URL(location, url).toString());
      if (!allowRedirectHost(next.hostname)) throw new HttpError(422, "O endereço redirecionou para um destino não permitido.");
      // cabeçalhos de autenticação não acompanham o redirecionamento para outro host
      if (next.host !== url.host) headers = {};
      url = next;
      continue;
    }
    return { status, headers: res.headers, body, finalUrl: url };
  }
  throw new HttpError(422, "Redirecionamentos demais.");
};
