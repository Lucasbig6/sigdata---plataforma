import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ApiConnectionInput, GSheetsConnectionInput, SourceTable } from "@shared/domain/sources";
import { toTableName } from "@shared/domain/sources";
import { HttpError } from "../http";
import { ingestCsv, ingestRows, releaseDuck, sourceDir } from "./duck";
import { safeGet } from "./http-fetch";

/**
 * Fontes importadas de um endereço (API REST e Google Sheets). Os dados são copiados para o
 * DuckDB da fonte, como num CSV; "Atualizar dados" busca de novo e substitui a tabela.
 */

const MAX_API_ROWS = 200_000;
const MAX_PAGES_LIMIT = 100;

/* ------------------------------------------------------------------ API REST */

const describeStatus = (status: number) =>
  status === 401 || status === 403
    ? "acesso negado, confira o cabeçalho de autenticação"
    : status === 404
      ? "endereço não encontrado"
      : status === 429
        ? "limite de requisições da API atingido"
        : `resposta ${status}`;

/** Acessa `a.b.0.c` dentro de um valor JSON. */
const pick = (value: unknown, pathExpr: string): unknown => {
  if (!pathExpr.trim()) return value;
  let current = value;
  for (const part of pathExpr.trim().split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
};

/** Lista de registros da resposta: pelo caminho informado ou, sem ele, a lista mais provável. */
const recordsOf = (body: unknown, recordsPath: string): unknown[] => {
  const found = pick(body, recordsPath);
  if (Array.isArray(found)) return found;
  if (recordsPath.trim()) {
    throw new HttpError(422, `O caminho "${recordsPath}" não aponta para uma lista na resposta.`);
  }
  if (found && typeof found === "object") {
    const lists = Object.values(found).filter(Array.isArray);
    if (lists.length === 1) return lists[0] as unknown[];
    return [found];
  }
  throw new HttpError(422, "A resposta não contém uma lista de registros. Informe o caminho dos registros.");
};

const flatten = (value: unknown, prefix: string, out: Record<string, unknown>, depth = 0) => {
  if (value !== null && typeof value === "object" && !Array.isArray(value) && depth < 4) {
    for (const [key, inner] of Object.entries(value)) flatten(inner, prefix ? `${prefix}_${key}` : key, out, depth + 1);
    return;
  }
  out[prefix || "valor"] = Array.isArray(value) || (value !== null && typeof value === "object") ? JSON.stringify(value) : value;
};

const toRows = (records: unknown[]): Record<string, unknown>[] => {
  const flat = records.map((record) => {
    const row: Record<string, unknown> = {};
    flatten(record, "", row);
    return row;
  });
  const keys = new Set<string>();
  for (const row of flat) for (const key of Object.keys(row)) keys.add(key);
  return flat.map((row) => Object.fromEntries([...keys].map((key) => [key, row[key] ?? null])));
};

const HEADER_NAME = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;

const requestHeaders = (cfg: ApiConnectionInput) => {
  const headers: Record<string, string> = {};
  for (const { name, value } of cfg.headers) {
    if (!name.trim()) continue;
    if (!HEADER_NAME.test(name.trim()) || /[\r\n]/.test(value)) throw new HttpError(400, `Cabeçalho inválido: "${name}".`);
    headers[name.trim()] = value;
  }
  return headers;
};

/** Busca todas as páginas da API e devolve os registros como linhas planas. */
export const fetchApiRows = async (cfg: ApiConnectionInput): Promise<Record<string, unknown>[]> => {
  const headers = requestHeaders(cfg);
  const maxPages = cfg.pagination.type === "none" ? 1 : Math.min(Math.max(cfg.maxPages, 1), MAX_PAGES_LIMIT);
  const records: unknown[] = [];
  let url = cfg.url;
  let previous = "";

  for (let page = 0; page < maxPages; page += 1) {
    let target = url;
    if (cfg.pagination.type === "page") {
      const next = new URL(cfg.url);
      next.searchParams.set(cfg.pagination.param, String(cfg.pagination.start + page));
      if (cfg.pagination.sizeParam && cfg.pagination.size) {
        next.searchParams.set(cfg.pagination.sizeParam, String(cfg.pagination.size));
      }
      target = next.toString();
    }
    // credenciais só seguem para o mesmo servidor do endereço original
    const sameOrigin = new URL(target).origin === new URL(cfg.url).origin;
    const res = await safeGet(target, sameOrigin ? headers : {});
    if (res.status < 200 || res.status >= 300) {
      throw new HttpError(422, `A API recusou o pedido (${describeStatus(res.status)}).`);
    }
    let body: unknown;
    try {
      body = JSON.parse(res.body.toString("utf8"));
    } catch {
      throw new HttpError(422, "A resposta da API não é um JSON válido.");
    }
    const batch = recordsOf(body, cfg.recordsPath);
    if (batch.length === 0) break;
    const signature = JSON.stringify(batch[0]);
    if (page > 0 && signature === previous) break; // a API ignora o parâmetro de página
    previous = signature;
    records.push(...batch);
    if (records.length > MAX_API_ROWS) {
      throw new HttpError(413, `A API retornou mais de ${MAX_API_ROWS.toLocaleString("pt-BR")} registros. Use filtros no endereço ou reduza as páginas.`);
    }
    if (cfg.pagination.type === "next") {
      const link = pick(body, cfg.pagination.path);
      if (typeof link !== "string" || !link) break;
      url = new URL(link, target).toString();
    }
  }
  if (records.length === 0) throw new HttpError(422, "A API não retornou nenhum registro.");
  return toRows(records);
};

export const ingestApi = async (id: string, cfg: ApiConnectionInput, tableName: string): Promise<SourceTable[]> => {
  const rows = await fetchApiRows(cfg);
  await releaseDuck(id);
  return ingestRows(id, [{ name: tableName, rows }]);
};

/* ------------------------------------------------------------- Google Sheets */

const SHEETS_ID = /^\/spreadsheets\/d\/([A-Za-z0-9_-]+)/;

/** Endereço de exportação CSV de uma planilha compartilhada por link. */
export const sheetsExportUrl = (raw: string): string => {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new HttpError(400, "Endereço inválido.");
  }
  const id = SHEETS_ID.exec(url.pathname)?.[1];
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com" || !id) {
    throw new HttpError(400, "Cole o link da planilha (https://docs.google.com/spreadsheets/d/…).");
  }
  const gid = /[#&?]gid=(\d+)/.exec(`${url.search}${url.hash}`)?.[1];
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
};

const googleHost = (host: string) => host === "docs.google.com" || host.endsWith(".google.com") || host.endsWith(".googleusercontent.com");

export const ingestSheets = async (id: string, cfg: GSheetsConnectionInput, tableName: string): Promise<SourceTable[]> => {
  const res = await safeGet(sheetsExportUrl(cfg.url), {}, googleHost);
  const type = String(res.headers["content-type"] ?? "");
  if (res.status !== 200 || type.includes("text/html")) {
    throw new HttpError(
      422,
      'Não foi possível ler a planilha. Em "Compartilhar", deixe o acesso como "Qualquer pessoa com o link" (leitor).',
    );
  }
  await mkdir(sourceDir(id), { recursive: true });
  const file = path.join(sourceDir(id), "original.csv");
  await writeFile(file, res.body);
  await releaseDuck(id);
  return ingestCsv(id, file, `${tableName}.csv`);
};

/** Nome da tabela de uma fonte importada: do nome da fonte, sem acento nem símbolos. */
export const importTableName = (name: string) => toTableName(name, new Set());
