import type { Role } from "@shared/roles";

/**
 * Política de cadastro e criação de contas pelo administrador.
 * - Cadastro aberto (`SIGDATA_OPEN_SIGNUP=true`; padrão: aberto fora de produção): qualquer pessoa cria conta.
 * - Fechado: só o admin cria contas. A primeira conta do sistema sempre pode ser criada.
 */
export const openSignup = () =>
  process.env.SIGDATA_OPEN_SIGNUP
    ? process.env.SIGDATA_OPEN_SIGNUP === "true"
    : process.env.NODE_ENV !== "production";

const key = (email: string) => email.trim().toLowerCase();

/** Contas que o admin está criando agora (email → papel): o gancho de cadastro as deixa passar. */
const adminCreations = new Map<string, Role>();

export const withAdminCreation = async <T>(email: string, role: Role, fn: () => Promise<T>) => {
  adminCreations.set(key(email), role);
  try {
    return await fn();
  } finally {
    adminCreations.delete(key(email));
  }
};

export const adminCreationRole = (email: string) => adminCreations.get(key(email));

/** Links de definição de senha gerados para o admin copiar (email → url). */
const accessLinks = new Map<string, string>();

export const rememberAccessLink = (email: string, url: string) => {
  if (accessLinks.has(key(email)) || adminLinkRequests.has(key(email))) accessLinks.set(key(email), url);
};

const adminLinkRequests = new Set<string>();

/** Executa `fn` (que dispara o envio do link) e devolve a URL gerada, para o admin repassar. */
export const captureAccessLink = async (email: string, fn: () => Promise<unknown>) => {
  adminLinkRequests.add(key(email));
  try {
    await fn();
    return accessLinks.get(key(email)) ?? null;
  } finally {
    adminLinkRequests.delete(key(email));
    accessLinks.delete(key(email));
  }
};
