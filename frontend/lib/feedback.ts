import { create } from "zustand";

/**
 * Avisos (toasts) e confirmações. Vive num store para poder ser chamado de
 * qualquer lugar (componentes, stores, cliente HTTP); `FeedbackHost` desenha.
 */

export type ToastTone = "success" | "error" | "info";
export type ToastItem = { id: number; tone: ToastTone; message: string };

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  /** Ação irreversível: botão em vermelho. */
  destructive?: boolean;
};
export type ConfirmRequest = ConfirmOptions & { resolve: (ok: boolean) => void };

type FeedbackState = {
  toasts: ToastItem[];
  confirmRequest: ConfirmRequest | null;
};

const MAX_TOASTS = 4;
const DURATION_MS: Record<ToastTone, number> = { success: 3500, info: 4000, error: 7000 };

let nextId = 1;

export const useFeedback = create<FeedbackState>(() => ({ toasts: [], confirmRequest: null }));

export const dismissToast = (id: number) =>
  useFeedback.setState((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));

const push = (tone: ToastTone, message: string) => {
  const id = nextId++;
  useFeedback.setState((state) => ({ toasts: [...state.toasts, { id, tone, message }].slice(-MAX_TOASTS) }));
  if (typeof window !== "undefined") window.setTimeout(() => dismissToast(id), DURATION_MS[tone]);
};

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
  info: (message: string) => push("info", message),
};

/** Substitui `window.confirm`: resolve `true` só se a pessoa confirmar. */
export const confirmAction = (options: ConfirmOptions): Promise<boolean> =>
  new Promise((resolve) => {
    // uma confirmação nova cancela a anterior ainda aberta
    useFeedback.getState().confirmRequest?.resolve(false);
    useFeedback.setState({ confirmRequest: { ...options, resolve } });
  });

export const settleConfirm = (ok: boolean) => {
  const request = useFeedback.getState().confirmRequest;
  useFeedback.setState({ confirmRequest: null });
  request?.resolve(ok);
};
