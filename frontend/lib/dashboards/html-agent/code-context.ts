/**
 * Contexto do agente de código do visual HTML: o código atual e os dados, em texto curto.
 * Linhas muito longas (geometria de mapa, dados embutidos) viram marcadores para não gastar a
 * cota de entrada do modelo; ao aplicar o código novo, os marcadores são trocados de volta.
 */

export type Code = { html: string; css: string; js: string };
export type CodePart = keyof Code;
export type Blobs = Record<string, string>;

const LONG_LINE = 300;
const MARKER = /(?:<!--|\/\*)@@LONGO:([a-z]\d+)@@(?:-->|\*\/)/g;
/** Teto de caracteres de cada parte no contexto (o resto é cortado, com aviso). */
const PART_LIMIT = 3500;

const marker = (part: CodePart, id: string) => (part === "html" ? `<!--@@LONGO:${id}@@-->` : `/*@@LONGO:${id}@@*/`);

/** Troca cada linha longa por um marcador e devolve o texto enxuto e o que foi guardado. */
export const elide = (code: Code): { text: Code; blobs: Blobs } => {
  const blobs: Blobs = {};
  let n = 0;
  const text = {} as Code;
  for (const part of ["html", "css", "js"] as const) {
    text[part] = code[part]
      .split("\n")
      .map((line) => {
        if (line.length <= LONG_LINE) return line;
        const id = `${part[0]}${++n}`;
        blobs[id] = line;
        return marker(part, id);
      })
      .join("\n");
  }
  return { text, blobs };
};

/** Devolve as linhas longas no lugar dos marcadores (marcador sem correspondência fica como está). */
export const restore = (text: string, blobs: Blobs): string =>
  text.replace(MARKER, (whole, id: string) => blobs[id] ?? whole);

const clip = (text: string) =>
  text.length > PART_LIMIT ? `${text.slice(0, PART_LIMIT)}\n…[restante cortado; só reescreva se for mudar essa parte inteira]` : text;

/** Texto de contexto enviado como instrução do sistema a cada mensagem. */
export const buildAgentContext = (input: {
  code: Code;
  columns: { name: string; kind: string }[];
  sample: Record<string, unknown>[];
  errors: string[];
}): { context: string; blobs: Blobs } => {
  const { text, blobs } = elide(input.code);
  const empty = !input.code.html.trim() && !input.code.js.trim();
  const lines = [
    "Estado atual do visual:",
    empty ? "(vazio: ainda não há código)" : `[HTML]\n${clip(text.html)}\n[CSS]\n${clip(text.css)}\n[JS]\n${clip(text.js)}`,
    input.columns.length
      ? `Colunas dos dados ligados: ${input.columns.map((column) => `${column.name} (${column.kind})`).join(", ")}`
      : "Ainda não há dados ligados (aba Dados): escreva o código para funcionar quando houver, e avise.",
    input.sample.length ? `Amostra (${input.sample.length} linhas): ${JSON.stringify(input.sample).slice(0, 700)}` : "",
    input.errors.length ? `Erros de execução agora: ${input.errors.join(" | ")}` : "",
  ];
  return { context: lines.filter(Boolean).join("\n"), blobs };
};
