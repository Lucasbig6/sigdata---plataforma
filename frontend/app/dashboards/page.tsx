"use client";

import { ArrowLeft, Eye, LayoutDashboard, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { LogoMark } from "@/components/sigdata/logo";
import { ThemeToggle } from "@/components/sigdata/theme-toggle";
import { confirmAction } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { CardSkeletons, EmptyState, ErrorState } from "@/components/sigdata/list-states";

const formatDate = (timestamp: number): string =>
  new Date(timestamp).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

type SharedEntry = { id: string; name: string; description: string; updatedAt: number; ownerName: string };

export default function DashboardsPage() {
  const router = useRouter();
  const hydrated = useDashboardsStore((state) => state.hydrated);
  const hydrate = useDashboardsStore((state) => state.hydrate);
  const loadError = useDashboardsStore((state) => state.loadError);
  const order = useDashboardsStore((state) => state.order);
  const dashboards = useDashboardsStore((state) => state.dashboards);
  const createDashboard = useDashboardsStore((state) => state.createDashboard);
  const deleteDashboard = useDashboardsStore((state) => state.deleteDashboard);
  const shareTokens = useDashboardsStore((state) => state.shareTokens);

  const [sharedWithMe, setSharedWithMe] = useState<SharedEntry[]>([]);

  useEffect(() => {
    hydrate();
    api<SharedEntry[]>("/api/dashboards/shared")
      .then(setSharedWithMe)
      .catch(() => undefined);
  }, [hydrate]);

  const items = useMemo(
    () =>
      order
        .map((id) => dashboards[id])
        .filter((dashboard): dashboard is NonNullable<typeof dashboard> => Boolean(dashboard))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [order, dashboards],
  );

  const handleCreate = () => {
    const id = createDashboard();
    router.push(`/dashboards/${id}`);
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-card/70 backdrop-blur">
        <div className="flex h-20 items-center gap-2 sm:gap-7 px-4 sm:px-8 lg:px-15">
          <Link
            href="/"
            aria-label="Voltar ao início"
            className="grid size-10 shrink-0 place-items-center rounded-md border border-border/70 text-foreground transition-colors hover:bg-muted/60"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
          <LogoMark className="h-11 w-auto shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl  font-semibold text-foreground pb-1">Dashboards</h1>
            <p className="truncate text-xs text-muted-foreground">
              Painéis da sua conta · dados ao vivo das suas fontes
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={handleCreate}
              className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="size-4" aria-hidden />
              Novo dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 sm:px-10 lg:px-30 py-6">
        {!hydrated ? (
          <CardSkeletons count={3} itemClassName="h-40" />
        ) : loadError ? (
          <ErrorState title="Não foi possível carregar os dashboards" message={loadError} onRetry={hydrate} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={LayoutDashboard}
            title="Nenhum dashboard ainda"
            description="Crie um painel do zero ou salve as visualizações de um projeto como dashboard."
            action={<Button onClick={handleCreate}>Criar dashboard</Button>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((dashboard) => (
              <article
                key={dashboard.id}
                className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card/60 p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="min-w-0 truncate text-sm font-medium text-foreground">
                    {dashboard.name}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${
                      dashboard.origin === "demo"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/70 bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    {dashboard.origin === "demo" ? "Exemplo" : "Seu"}
                  </span>
                  {shareTokens[dashboard.id] ? (
                    <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                      Público
                    </span>
                  ) : null}
                </div>

                <p className="line-clamp-2 min-h-8 text-xs leading-relaxed text-muted-foreground">
                  {dashboard.description || "Sem descrição."}
                </p>

                <p className="text-[10px] text-muted-foreground">
                  {dashboard.elements.length} elementos · atualizado{" "}
                  {formatDate(dashboard.updatedAt)}
                </p>

                <div className="mt-auto flex gap-1.5 pt-1">
                  <Link
                    href={`/dashboards/${dashboard.id}`}
                    className="flex-1 rounded-md bg-primary px-2 py-1.5 text-center text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Abrir
                  </Link>
                  <Link
                    href={`/dashboards/${dashboard.id}?preview=1`}
                    aria-label={`Pré-visualizar ${dashboard.name}`}
                    title="Pré-visualizar"
                    className="grid size-8 place-items-center rounded-md border border-border/70 text-foreground transition-colors hover:bg-muted/60"
                  >
                    <Eye className="size-3.5" aria-hidden />
                  </Link>
                  <button
                    type="button"
                    aria-label={`Excluir ${dashboard.name}`}
                    title="Excluir"
                    onClick={() => {
                      void confirmAction({
                        title: `Excluir "${dashboard.name}"?`,
                        description: "Esta ação não pode ser desfeita.",
                        confirmLabel: "Excluir",
                        destructive: true,
                      }).then((ok) => ok && deleteDashboard(dashboard.id));
                    }}
                    className="grid size-8 place-items-center rounded-md border border-border/70 text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {sharedWithMe.length > 0 ? (
          <section aria-labelledby="compartilhados" className="mt-10">
            <h2 id="compartilhados" className="mb-3 text-sm font-medium text-foreground">
              Compartilhados com você
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sharedWithMe.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/dashboards/compartilhado/${entry.id}`}
                  className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-card/60 p-4 transition-colors hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/40 outline-none"
                >
                  <span className="truncate text-sm font-medium text-foreground">{entry.name}</span>
                  <span className="line-clamp-2 min-h-8 text-xs leading-relaxed text-muted-foreground">
                    {entry.description || "Sem descrição."}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    de {entry.ownerName} · somente leitura · {formatDate(entry.updatedAt)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
