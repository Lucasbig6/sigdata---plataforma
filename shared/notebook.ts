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
