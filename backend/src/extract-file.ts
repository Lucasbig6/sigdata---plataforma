import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import type { UIMessage } from "ai";

type FilePart = Extract<UIMessage["parts"][number], { type: "file" }>;
type TextPart = Extract<UIMessage["parts"][number], { type: "text" }>;

const MAX_FILE_CHARS = 60_000;
const MAX_TOTAL_CHARS = 240_000;
const MAX_IMAGE_PARTS = 3;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_SHEET_ROWS = 500;
const CACHE_LIMIT = 32;

const extractionCache = new Map<string, string>();

class UnsupportedFileError extends Error {}

const dataUrlPattern = /^data:([^;,]*)(;base64)?,([\s\S]*)$/;

const extOf = (part: FilePart): string => {
  const fromName = part.filename?.split(".").pop()?.toLowerCase();
  if (fromName && fromName !== part.filename?.toLowerCase()) return fromName;
  const fromMime = part.mediaType.split("/").pop()?.toLowerCase();
  return fromMime && !fromMime.includes("-") ? fromMime : "";
};

const isImage = (mediaType: string) => mediaType === "image" || mediaType.startsWith("image/");

async function readBytes(part: FilePart): Promise<Uint8Array> {
  const url = part.url;
  const dataUrl = dataUrlPattern.exec(url);
  if (dataUrl) {
    const [, , isBase64, payload = ""] = dataUrl;
    return isBase64
      ? new Uint8Array(Buffer.from(payload, "base64"))
      : new TextEncoder().encode(decodeURIComponent(payload));
  }
  if (/^https?:\/\//i.test(url)) {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`download falhou (HTTP ${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }
  throw new UnsupportedFileError("arquivo indisponível nesta requisição");
}

const decodeText = (bytes: Uint8Array) => new TextDecoder("utf-8", { fatal: false }).decode(bytes);

function looksLikeText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, 2048);
  for (const byte of sample) if (byte === 0) return false;
  return true;
}

const quoteCsv = (value: string) =>
  /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

function cellToText(cell: ExcelJS.Cell): string {
  if (cell === null || cell === undefined) return "";
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("result" in value && value.result !== undefined) return String(value.result);
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("hyperlink" in value) return String(value.hyperlink);
    return JSON.stringify(value);
  }
  return typeof value === "string" ? value : String(value);
}

async function extractSpreadsheet(bytes: Uint8Array): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
  const sections: string[] = [];
  for (const sheet of workbook.worksheets) {
    const rows: string[] = [];
    let truncated = false;
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rows.length >= MAX_SHEET_ROWS) {
        truncated = true;
        return;
      }
      const cells: string[] = [];
      for (let column = 1; column <= row.cellCount; column++) {
        cells.push(cellToText(row.getCell(column)));
      }
      if (cells.length === 0 && rowNumber === 1) return;
      rows.push(cells.map(quoteCsv).join(","));
    });
    if (rows.length === 0) continue;
    sections.push(
      `### Aba: ${sheet.name}\n${rows.join("\n")}${
        truncated ? `\n(...truncado: apenas as primeiras ${MAX_SHEET_ROWS} linhas desta aba)` : ""
      }`,
    );
  }
  if (sections.length === 0) throw new UnsupportedFileError("planilha sem conteúdo");
  return sections.join("\n\n");
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(bytes)), {
    mergePages: true,
  });
  return text.replace(/\s*\n\s*\n\s*/g, "\n").trim();
}

async function extractContent(part: FilePart, bytes: Uint8Array): Promise<string> {
  const mediaType = part.mediaType.toLowerCase();
  const ext = extOf(part);

  if (mediaType === "application/pdf" || ext === "pdf") return extractPdf(bytes);

  if (
    mediaType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mediaType === "application/vnd.oasis.opendocument.spreadsheet" ||
    mediaType === "application/vnd.ms-excel" ||
    ["xlsx", "xlsm", "xlsb", "ods"].includes(ext)
  )
    return extractSpreadsheet(bytes);

  if (
    mediaType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return value;
  }

  if (mediaType.startsWith("text/") || mediaType === "application/json") return decodeText(bytes);

  if (["csv", "tsv", "txt", "md", "log", "json", "xml", "yaml", "yml"].includes(ext))
    return decodeText(bytes);

  if (looksLikeText(bytes)) return decodeText(bytes);

  throw new UnsupportedFileError(
    "formato não suportado — anexe PDF, planilha (.xlsx), CSV, DOCX ou texto",
  );
}

function note(text: string): TextPart {
  return { type: "text", text };
}

function describeFile(part: FilePart): string {
  return `${part.filename ?? "arquivo"} (${part.mediaType || "tipo desconhecido"})`;
}

function wrapExtracted(filename: string, body: string): string {
  return `[Arquivo anexado: ${filename}]\n${body}\n[Fim do arquivo]`;
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n(...conteúdo truncado no limite de ${limit} caracteres)`;
}

async function extractCached(key: string, part: FilePart, bytes: Uint8Array): Promise<string> {
  const cached = extractionCache.get(key);
  if (cached !== undefined) {
    extractionCache.delete(key);
    extractionCache.set(key, cached);
    return cached;
  }
  const text = await extractContent(part, bytes);
  if (extractionCache.size >= CACHE_LIMIT) {
    const oldest = extractionCache.keys().next().value;
    if (oldest !== undefined) extractionCache.delete(oldest);
  }
  extractionCache.set(key, text);
  return text;
}

function usableImageParts(messages: UIMessage[]): Set<string> {
  const locations: string[] = [];
  messages.forEach((message, mi) => {
    if (!Array.isArray(message.parts)) return;
    message.parts.forEach((part, pi) => {
      if (part.type === "file" && isImage(part.mediaType)) locations.push(`${mi}:${pi}`);
    });
  });
  return new Set(locations.slice(-MAX_IMAGE_PARTS));
}

/**
 * Converte as partes de arquivo não-imagem em texto extraído no servidor,
 * para que o provider Groq (que só aceita imagens) não rejeite a requisição.
 * A ordem das partes é preservada; imagens além do limite da Groq viram nota.
 */
export async function sanitizeMessages(messages: UIMessage[]): Promise<UIMessage[]> {
  const keepImages = usableImageParts(messages);
  let budget = MAX_TOTAL_CHARS;

  return Promise.all(
    messages.map(async (message, mi) => {
      if (!Array.isArray(message.parts)) return message;
      return {
        ...message,
        parts: await Promise.all(
          message.parts.map(async (part, pi): Promise<UIMessage["parts"][number]> => {
            if (part.type !== "file") return part;

            const filename = describeFile(part);

            if (isImage(part.mediaType)) {
              if (keepImages.has(`${mi}:${pi}`)) return part;
              return note(
                `[imagem descartada: ${filename} — limite de ${MAX_IMAGE_PARTS} imagens por requisição]`,
              );
            }

            if (budget <= 0)
              return note(`[arquivo omitido: ${filename} — limite de contexto atingido]`);

            try {
              const bytes = await readBytes(part);
              if (bytes.length > MAX_FILE_BYTES)
                throw new UnsupportedFileError(
                  `arquivo maior que ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB`,
                );

              const key = `${part.mediaType}:${createHash("sha256").update(bytes).digest("hex")}`;
              let text = await extractCached(key, part, bytes);

              if (!text.trim())
                text =
                  "Não foi possível extrair texto deste arquivo. Se for um PDF digitalizado (imagem), não há camada de texto — descreva ou resuma o conteúdo manualmente.";

              text = truncate(text, Math.min(MAX_FILE_CHARS, budget));
              budget -= text.length;
              return note(wrapExtracted(filename, text));
            } catch (error) {
              const reason =
                error instanceof UnsupportedFileError
                  ? error.message
                  : error instanceof Error
                    ? `falha ao ler o arquivo (${error.message})`
                    : "falha ao ler o arquivo";
              return note(
                `[Arquivo anexado: ${filename}]\nNão foi possível processar este arquivo: ${reason}.\n[Fim do arquivo]`,
              );
            }
          }),
        ),
      };
    }),
  );
}
