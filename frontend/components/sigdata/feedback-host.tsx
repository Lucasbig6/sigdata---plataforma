"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dismissToast, settleConfirm, useFeedback, type ToastTone } from "@/lib/feedback";

const TONES: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: "text-primary" },
  error: { icon: AlertCircle, className: "text-destructive" },
  info: { icon: Info, className: "text-muted-foreground" },
};

/** Monta uma vez no layout: desenha os avisos e o diálogo de confirmação. */
export const FeedbackHost = () => {
  const toasts = useFeedback((state) => state.toasts);
  const request = useFeedback((state) => state.confirmRequest);

  return (
    <>
      <div
        role="region"
        aria-label="Notificações"
        className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((item) => {
          const { icon: Icon, className } = TONES[item.tone];
          return (
            <div
              key={item.id}
              role={item.tone === "error" ? "alert" : "status"}
              className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-border bg-popover p-3 text-sm text-popover-foreground shadow-md animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${className}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="leading-snug break-words">{item.message}</p>
                {item.action ? (
                  <Link
                    href={item.action.href}
                    onClick={() => dismissToast(item.id)}
                    className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
                  >
                    {item.action.label}
                  </Link>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Fechar aviso"
                onClick={() => dismissToast(item.id)}
                className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>

      <Dialog open={request !== null} onOpenChange={(open) => !open && settleConfirm(false)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{request?.title}</DialogTitle>
            {request?.description ? <DialogDescription>{request.description}</DialogDescription> : null}
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => settleConfirm(false)}>
              Cancelar
            </Button>
            <Button
              variant={request?.destructive ? "destructive" : "default"}
              onClick={() => settleConfirm(true)}
              autoFocus
            >
              {request?.confirmLabel ?? "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
