/**
 * Documento do visual personalizado (elemento "html"). O código do autor roda num iframe com
 * `sandbox="allow-scripts"` (sem `allow-same-origin`): origem opaca, sem acesso à sessão, aos
 * cookies nem à API do SIGDATA. Este módulo só monta o texto do documento — puro e testável.
 */

/** Servidores de bibliotecas liberados para scripts, estilos e fontes (Chart.js, D3, etc.). */
export const HTML_CDN_HOSTS = ["https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "https://unpkg.com"] as const;

const CDN = HTML_CDN_HOSTS.join(" ");

/**
 * Política do documento: nada de rede além das bibliotecas acima. `connect-src 'none'` bloqueia
 * fetch/XHR/WebSocket e imagens só podem vir embutidas (data:/blob:), o que fecha os caminhos
 * comuns para enviar os dados para fora.
 */
export const HTML_CSP = [
  "default-src 'none'",
  `script-src 'unsafe-inline' ${CDN}`,
  `style-src 'unsafe-inline' ${CDN}`,
  "img-src data: blob:",
  `font-src data: ${CDN}`,
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-src 'none'",
].join("; ");

/** Variáveis do tema repassadas ao iframe (nomes sem `--`). */
export const HTML_THEME_VARS = [
  "background",
  "foreground",
  "muted-foreground",
  "border",
  "primary",
  "panel",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
] as const;

export type HtmlTheme = Partial<Record<(typeof HTML_THEME_VARS)[number], string>> & { dark?: boolean };

export type HtmlPayload = {
  status: "loading" | "ready" | "error";
  error?: string;
  columns: string[];
  rows: Record<string, unknown>[];
  theme: HtmlTheme;
  /** Escolha atual deste visual (feita por `sigdata.select`), para destacá-la no desenho. */
  selection: { column: string; value: string } | null;
  /** Há filtros de outros elementos aplicados aos dados recebidos. */
  filtered?: boolean;
};

/** Mensagem do iframe pedindo para filtrar (`value` nulo = limpar). */
export type HtmlSelectMessage = { column: string; value: string | null };

/** Marca das mensagens trocadas com o iframe. */
export const HTML_MESSAGE_TAG = "sigdata";

/** Impede que o código do autor feche a tag em que foi colocado. */
const escapeForTag = (code: string, tag: "style" | "script") =>
  code.replace(new RegExp(`</(${tag})`, "gi"), "<\\/$1");

const BRIDGE = `
(function () {
  var listeners = [];
  var api = { status: "loading", error: null, rows: [], columns: [], theme: {}, selection: null, filtered: false };
  api.onData = function (fn) {
    listeners.push(fn);
    if (api.status !== "loading") fn(api);
  };
  // filtra os outros elementos do painel; repetir a mesma escolha remove o filtro
  api.select = function (column, value) {
    if (typeof column !== "string") return;
    window.parent.postMessage({ ${HTML_MESSAGE_TAG}: 1, type: "select", column: column, value: value === null || value === undefined ? null : String(value) }, "*");
  };
  api.clear = function () {
    window.parent.postMessage({ ${HTML_MESSAGE_TAG}: 1, type: "select", column: "", value: null }, "*");
  };
  window.sigdata = api;
  window.addEventListener("message", function (event) {
    var data = event.data;
    if (event.source !== window.parent || !data || data.${HTML_MESSAGE_TAG} !== 1 || data.type !== "data") return;
    api.status = data.status;
    api.error = data.error || null;
    api.rows = data.rows || [];
    api.columns = data.columns || [];
    api.theme = data.theme || {};
    api.selection = data.selection || null;
    api.filtered = !!data.filtered;
    var root = document.documentElement;
    Object.keys(api.theme).forEach(function (key) {
      if (key !== "dark") root.style.setProperty("--sd-" + key, api.theme[key]);
    });
    root.style.colorScheme = api.theme.dark ? "dark" : "light";
    listeners.slice().forEach(function (fn) {
      try { fn(api); } catch (error) { console.error(error); reportError(error && error.message || error); }
    });
  });
  // erros do código do autor vão para a janela de código (e para o assistente, que se corrige)
  function reportError(message) {
    window.parent.postMessage({ ${HTML_MESSAGE_TAG}: 1, type: "error", message: String(message).slice(0, 300) }, "*");
  }
  window.addEventListener("error", function (event) { reportError(event.message); });
  window.addEventListener("unhandledrejection", function (event) {
    reportError(event.reason && event.reason.message || event.reason);
  });
  window.parent.postMessage({ ${HTML_MESSAGE_TAG}: 1, type: "ready" }, "*");
})();
`;

const BASE_CSS = `
html, body { margin: 0; padding: 0; height: 100%; }
body { font: 13px/1.5 system-ui, sans-serif; color: var(--sd-foreground, #16202e); background: transparent; }
`;

/** Monta o documento completo (`srcdoc` do iframe) a partir do código do autor. */
export const buildSandboxDoc = (code: { html: string; css: string; js: string }): string =>
  `<!doctype html><html><head><meta charset="utf-8">` +
  `<meta http-equiv="Content-Security-Policy" content="${HTML_CSP}">` +
  `<meta name="viewport" content="width=device-width, initial-scale=1">` +
  `<style>${BASE_CSS}</style><style>${escapeForTag(code.css, "style")}</style></head>` +
  `<body>${code.html}<script>${BRIDGE}</script><script>${escapeForTag(code.js, "script")}</script></body></html>`;
