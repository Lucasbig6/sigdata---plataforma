"use client";

import { useParams } from "next/navigation";

/** Projeto aberto (rota `/projetos/[id]`), ou null fora do workspace. */
export const useNotebookId = (): string | null => {
  const id = useParams<{ id?: string }>()?.id;
  return typeof id === "string" ? id : null;
};

/** Mesma leitura, para código que roda fora de componentes (ferramentas do agente, handlers). */
export const currentNotebookId = (): string | null => {
  const match = window.location.pathname.match(/^\/projetos\/([^/]+)/);
  return match?.[1] ?? null;
};
