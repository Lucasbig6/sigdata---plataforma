import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { HttpError } from "./http";

/**
 * Proteção contra SSRF nas conexões com bancos externos: o host informado pelo
 * usuário é resolvido aqui e recusado se apontar para a rede interna do servidor
 * (loopback, redes privadas, link-local/metadados de nuvem).
 *
 * Em desenvolvimento é liberado (o banco local do compose roda em localhost);
 * em produção só com SIGDATA_ALLOW_PRIVATE_HOSTS=true.
 */

const allowPrivate = () =>
  process.env.SIGDATA_ALLOW_PRIVATE_HOSTS
    ? process.env.SIGDATA_ALLOW_PRIVATE_HOSTS === "true"
    : process.env.NODE_ENV !== "production";

const ipv4Parts = (ip: string) => ip.split(".").map(Number);

const isPrivateV4 = (ip: string) => {
  const [a = 0, b = 0] = ipv4Parts(ip);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local e metadados (169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast e reservado
  );
};

/** Endereço IPv6 (já em minúsculas) que não é público. */
const isPrivateV6 = (ip: string) => {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return isPrivateV4(mapped[1]);
  return (
    ip === "::" ||
    ip === "::1" ||
    ip.startsWith("fe80:") || // link-local
    ip.startsWith("fc") ||
    ip.startsWith("fd") || // unique local
    ip.startsWith("ff") // multicast
  );
};

export const isPrivateAddress = (ip: string) => {
  const version = isIP(ip);
  if (version === 4) return isPrivateV4(ip);
  if (version === 6) return isPrivateV6(ip.toLowerCase());
  return true;
};

/**
 * Resolve `host` e devolve o IP a conectar (evita nova resolução entre a
 * checagem e a conexão — DNS rebinding). Lança 422 se for endereço interno.
 */
export const resolveSafeHost = async (host: string): Promise<string> => {
  let addresses: string[];
  try {
    addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((entry) => entry.address);
  } catch {
    throw new HttpError(422, `Não foi possível resolver o host "${host}".`);
  }
  const first = addresses[0];
  if (!first) throw new HttpError(422, `Não foi possível resolver o host "${host}".`);
  if (!allowPrivate() && addresses.some(isPrivateAddress)) {
    throw new HttpError(422, "Este endereço aponta para uma rede interna e não é permitido.");
  }
  return first;
};
