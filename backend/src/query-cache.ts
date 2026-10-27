/**
 * Cache em memória das consultas dos dashboards.
 *
 * - Respostas iguais (mesma fonte, mesma versão do schema, mesmo SQL) são
 *   reaproveitadas por alguns segundos: dezenas de visitantes de um link
 *   público não geram dezenas de consultas idênticas.
 * - Consultas idênticas feitas ao mesmo tempo compartilham a mesma execução.
 * - A chave inclui o `updatedAt` da fonte: recarregar o schema ou os dados do
 *   arquivo invalida sozinho; fontes externas expiram pelo TTL.
 */

const TTL_MS = Number(process.env.QUERY_CACHE_TTL_MS) || 30_000;
const MAX_ENTRIES = Number(process.env.QUERY_CACHE_MAX) || 500;

type Entry = { at: number; value: Promise<unknown> };

const store = new Map<string, Entry>();

export const queryCacheKey = (sourceId: string, version: number, limit: number | undefined, sql: string) =>
  `${sourceId}|${version}|${limit ?? ""}|${sql}`;

export const cachedQuery = <T>(key: string, load: () => Promise<T>, options: { fresh?: boolean } = {}): Promise<T> => {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && !options.fresh && now - hit.at < TTL_MS) {
    // reinsere para manter a ordem de uso (LRU simples)
    store.delete(key);
    store.set(key, hit);
    return hit.value as Promise<T>;
  }
  const value = load();
  store.delete(key);
  store.set(key, { at: now, value });
  // erro não fica guardado: a próxima tentativa consulta de novo
  value.catch(() => {
    if (store.get(key)?.value === value) store.delete(key);
  });
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
  return value;
};

/** Descarta tudo que veio de uma fonte (ex.: ao excluí-la). */
export const invalidateSourceCache = (sourceId: string) => {
  for (const key of store.keys()) {
    if (key.startsWith(`${sourceId}|`)) store.delete(key);
  }
};

export const queryCacheSize = () => store.size;
