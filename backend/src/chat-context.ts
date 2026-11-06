import type { UIMessage } from "ai";

/** `:tabela[Rótulo]{name=id}` — menção feita com @ no compositor do chat. */
const TABLE_MENTION = /:tabela(?:\[([^\]\n]{1,1024})\](?:\{name=([^}\n]{1,1024})\})?|\{label="([^"\n]{1,1024})"(?: name="([^"\n]{1,1024})")?\})/g;

const MAX_QUOTE_CHARS = 2000;

const readQuote = (message: UIMessage): string | null => {
  const custom = (message.metadata as { custom?: { quote?: { text?: unknown } } } | undefined)?.custom;
  const text = custom?.quote?.text;
  return typeof text === "string" && text.trim() ? text.trim().slice(0, MAX_QUOTE_CHARS) : null;
};

/** Troca a sintaxe de menção por texto que o modelo entende. */
export const resolveMentions = (text: string) =>
  text.replace(TABLE_MENTION, (_match, label, id, quotedLabel, quotedId) => {
    const name = id ?? quotedId ?? label ?? quotedLabel;
    return `a tabela "${name}"`;
  });

/**
 * Prepara as mensagens do usuário para o modelo: menções viram texto e a citação
 * (trecho selecionado de uma resposta anterior) vem como bloco de citação antes
 * da pergunta. Não altera as mensagens originais, que seguem para o histórico.
 */
export const withUserContext = (messages: UIMessage[]): UIMessage[] =>
  messages.map((message) => {
    if (message.role !== "user") return message;

    const quote = readQuote(message);
    let quoteApplied = false;
    const parts = message.parts.map((part) => {
      if (part.type !== "text") return part;
      let text = resolveMentions(part.text);
      if (quote && !quoteApplied) {
        const blockquote = quote.split("\n").map((line) => `> ${line}`).join("\n");
        text = `Trecho citado da conversa:\n${blockquote}\n\n${text}`;
        quoteApplied = true;
      }
      return { ...part, text };
    });

    return { ...message, parts };
  });
