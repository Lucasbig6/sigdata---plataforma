"use client";

import { ArrowLeft, Eye, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { LogoMark } from "@/components/sigdata/logo";
import { ThemeToggle } from "@/components/sigdata/theme-toggle";

const formatDate = (timestamp: number): string =>
  new Date(timestamp).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default function DashboardsPage() {
  const router = useRouter();
  const hydrated = useDashboardsStore((state) => state.hydrated);
  const hydrate = useDashboardsStore((state) => state.hydrate);
  const order = useDashboardsStore((state) => state.order);
  const dashboards = useDashboardsStore((state) => state.dashboards);
  const createDashboard = useDashboardsStore((state) => state.createDashboard);
  const deleteDashboard = useDashboardsStore((state) => state.deleteDashboard);

  useEffect(() => {
    hydrate();
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
      <header className="sticky top-0 z-10 border-b border-border/60 bg-card/70 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link
            href="/"
            aria-label="Voltar ao início"
            className="grid size-8 shrink-0 place-items-center rounded-md border border-border/70 text-foreground transition-colors hover:bg-muted/60"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
          <LogoMark className="size-8 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-foreground">Dashboards</h1>
            <p className="truncate text-[11px] text-muted-foreground">
              Painéis salvos neste navegador · dados de demonstração
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={handleCreate}
              className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="size-4" aria-hidden />
              Novo dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {!hydrated ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-40 animate-pulse rounded-xl border border-border/60 bg-card/50"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">Nenhum dashboard ainda</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Crie um painel do zero ou abra um dos exemplos de demonstração enquanto não houver
              nenhum salvo.
            </p>
            <button
              type="button"
              onClick={handleCreate}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              Criar dashboard
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                    {dashboard.origin === "demo" ? "Demonstração" : "Seu"}
                  </span>
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
                      if (
                        window.confirm(
                          `Excluir o dashboard "${dashboard.name}"? Esta ação não pode ser desfeita.`,
                        )
                      ) {
                        deleteDashboard(dashboard.id);
                      }
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
      </main>
    </div>
  );
}
