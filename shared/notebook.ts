/** Projeto (notebook) como trafega na API. */
export type Notebook = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  coverIndex: number;
  sourceCount: number;
  /** Fonte de dados ativa no workspace do projeto. */
  sourceId: string | null;
};

export const DEFAULT_NOTEBOOK_TITLE = "Projeto sem título";

export const COVER_COUNT = 8;

/** Conversa dentro de um projeto. Resultados, painel e fonte ativa ficam no projeto. */
export type Chat = {
  id: string;
  projectId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

export const DEFAULT_CHAT_TITLE = "Nova conversa";

/** Título automático a partir da primeira pergunta do usuário. */
export const titleFromQuestion = (text: string): string => {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 80 ? `${clean.slice(0, 79).trimEnd()}…` : clean;
};
