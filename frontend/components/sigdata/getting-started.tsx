"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { useDatasetsStore } from "@/lib/datasets/store";
import { useNotebooksStore } from "@/lib/notebooks/store";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "sigdata.onboarding.dismissed.v1";

/** Primeiros passos: o progresso vem dos dados reais da conta, não de um contador à parte. */
export const GettingStarted = () => {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(true);
  const datasets = useDatasetsStore((state) => state.datasets);
  const datasetsReady = useDatasetsStore((state) => state.hydrated);
  const notebooks = useNotebooksStore((state) => state.notebooks);
  const dashboards = useDashboardsStore((state) => state.dashboards);
  const shareTokens = useDashboardsStore((state) => state.shareTokens);
  const dashboardsReady = useDashboardsStore((state) => state.hydrated);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    useDatasetsStore.getState().hydrate();
    useDashboardsStore.getState().hydrate();
  }, []);

  if (dismissed || !datasetsReady || !dashboardsReady) return null;

  const own = Object.values(dashboards).filter((dashboard) => dashboard.origin !== "demo");
  const steps = [
    {
      done: datasets.some((dataset) => dataset.kind !== "dataset" && dataset.kind !== "demo"),
      label: "Conectar sua própria fonte de dados",
      href: "/fontes-de-dados",
      cta: "Conectar fonte",
    },
    {
      done: notebooks.length > 0,
      label: "Fazer uma pergunta aos seus dados no chat",
      href: null,
      cta: "Nova conversa",
    },
    { done: own.length > 0, label: "Montar um dashboard", href: "/dashboards", cta: "Criar dashboard" },
    {
      done: Object.values(shareTokens).some(Boolean),
      label: "Compartilhar um dashboard por link",
      href: "/dashboards",
      cta: "Ver dashboards",
    },
  ];
  const completed = steps.filter((step) => step.done).length;
  if (completed === steps.length) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* só vale nesta sessão */
    }
  };

  return (
    <section aria-label="Primeiros passos" className="mb-8 rounded-xl border border-border/70 bg-card/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">
          Primeiros passos <span className="text-muted-foreground">· {completed} de {steps.length}</span>
        </h2>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dispensar primeiros passos"
          className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <li key={step.label} className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/60 p-3">
            <span className="flex items-start gap-2 text-xs text-foreground">
              <span
                className={cn(
                  "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                  step.done ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
              >
                {step.done ? <Check className="size-3" aria-label="Concluído" /> : null}
              </span>
              <span className={cn(step.done && "text-muted-foreground line-through")}>{step.label}</span>
            </span>
            {step.done ? null : step.href ? (
              <Link href={step.href} className="self-start text-xs font-medium text-primary hover:underline">
                {step.cta}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => router.push(`/workspace?notebook=${useNotebooksStore.getState().createNotebook()}`)}
                className="self-start text-xs font-medium text-primary hover:underline"
              >
                {step.cta}
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
};
