import { create } from "zustand";

/**
 * Erros de execução dos visuais HTML (por elemento), reportados pelo iframe. A janela de código os
 * mostra e o assistente os lê depois de aplicar um código novo, para se corrigir sozinho.
 */
const MAX_ERRORS = 5;

type State = {
  errors: Record<string, string[]>;
  push: (elementId: string, message: string) => void;
  clear: (elementId: string) => void;
};

export const useHtmlRuntime = create<State>((set) => ({
  errors: {},
  push: (elementId, message) =>
    set((state) => {
      const current = state.errors[elementId] ?? [];
      if (current.includes(message) || current.length >= MAX_ERRORS) return state;
      return { errors: { ...state.errors, [elementId]: [...current, message] } };
    }),
  clear: (elementId) =>
    set((state) => {
      if (!(elementId in state.errors)) return state;
      const { [elementId]: _removed, ...rest } = state.errors;
      return { errors: rest };
    }),
}));
