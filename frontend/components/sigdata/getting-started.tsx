"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useRole } from "@/lib/auth-client";
import { canManageData } from "@shared/roles";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { useDatasetsStore } from "@/lib/datasets/store";
import { useNotebooksStore } from "@/lib/notebooks/store";
import { cn } from "@/lib/utils";
import { projectHref } from "@/lib/routes";

const DISMISS_KEY = "sigdata.onboarding.dismissed.v1";

/** Mostra só o próximo passo; o progresso vem dos dados reais da conta. */
export const GettingStarted = () => {
  const router = useRouter();
  const role = useRole();
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

  const ownDashboards = Object.values(dashboards).filter((dashboard) => dashboard.origin !== "demo");
  // conectar fontes é coisa de analista/admin; quem só usa dados começa direto na pergunta
  const connectStep = {
    done: datasets.some((dataset) => dataset.kind !== "dataset" && dataset.kind !== "demo"),
    label: "Conecte sua fonte de dados",
    href: "/fontes-de-dados" as string | null,
    cta: "Conectar fonte",
  };
  const steps = [
    ...(canManageData(role ?? "usuario") ? [connectStep] : []),
    { done: notebooks.length > 0, label: "Pergunte algo aos seus dados", href: null, cta: "Nova conversa" },
    { done: ownDashboards.length > 0, label: "Monte um dashboard", href: "/dashboards", cta: "Criar dashboard" },
    {
      done: Object.values(shareTokens).some(Boolean),
      label: "Compartilhe um dashboard por link",
      href: "/dashboards",
      cta: "Ver dashboards",
    },
  ];
  const next = steps.find((step) => !step.done);
  if (!next) return null;
  const completed = steps.filter((step) => step.done).length;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* só vale nesta sessão */
    }
  };

  return (
    <section
      aria-label="Próximo passo"
      className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border/70 bg-card px-4 py-3"
    >
      <span className="flex shrink-0 gap-1" role="img" aria-label={`${completed} de ${steps.length} passos concluídos`}>
        {steps.map((step, index) => (
          <span key={index} className={cn("h-1.5 w-5 rounded-full", step.done ? "bg-primary" : "bg-border")} />
        ))}
      </span>
      <p className="order-last min-w-full text-sm text-foreground sm:order-none sm:min-w-0 sm:flex-1 sm:truncate">{next.label}</p>
      {next.href ? (
        <Button size="sm" variant="outline" render={<Link href={next.href} />} nativeButton={false}>
          {next.cta}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push(projectHref(useNotebooksStore.getState().createNotebook()))}
        >
          {next.cta}
        </Button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dispensar dica"
        className="ml-auto grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground sm:ml-0 hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </section>
  );
};
