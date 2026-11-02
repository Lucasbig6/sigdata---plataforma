"use client";

import { Eye, LayoutDashboard, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { CoverArt } from "@/components/sigdata/cover-art";
import { coverGradient } from "@/components/sigdata/notebook-card";
import { AppHeader } from "@/components/sigdata/app-header";
import { PageHeading } from "@/components/sigdata/page-heading";
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

/** Mesma linguagem visual dos cartões de projeto: capa em degradê, título grande e ações discretas. */
const DashboardCard = ({
  dashboard,
  isPublic,
  onDelete,
}: {
  dashboard: { id: string; name: string; origin: string; elements: unknown[]; updatedAt: number };
  isPublic: boolean;
  onDelete: () => void;
}) => {
  const index = [...dashboard.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const round = "grid size-8 place-items-center rounded-xl bg-white/10 text-white/90 ring-1 ring-white/20 backdrop-blur-md transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white/60 outline-none";

  return (
    <article className="group relative">
      <Link
        href={`/dashboards/${dashboard.id}`}
        className="relative block aspect-[3/2] overflow-hidden rounded-2xl ring-1 ring-inset ring-white/10 outline-none transition-all duration-200 hover:scale-[1.015] hover:shadow-lg hover:shadow-black/20 focus-visible:ring-2 focus-visible:ring-ring/60"
        style={{ backgroundImage: coverGradient(index) }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(130%_90%_at_50%_-10%,rgba(255,255,255,0.22),transparent_55%)]" aria-hidden />
        <CoverArt index={index} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent" aria-hidden />
        <span className="absolute top-3 left-3 grid size-9 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur-md">
          <LayoutDashboard className="size-4 text-white" aria-hidden />
        </span>
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-5">
          <h2 className="line-clamp-2 text-2xl leading-snug font-medium tracking-tight text-white drop-shadow-sm">{dashboard.name}</h2>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-white/75">
            <span>{dashboard.elements.length} elementos · {formatDate(dashboard.updatedAt)}</span>
            {dashboard.origin === "demo" ? <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">Exemplo</span> : null}
            {isPublic ? <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">Link público</span> : null}
          </p>
        </div>
      </Link>
      <div className="absolute top-3 right-3 flex gap-1.5">
        <Link href={`/dashboards/${dashboard.id}?preview=1`} aria-label={`Pré-visualizar ${dashboard.name}`} title="Pré-visualizar" className={round}>
          <Eye className="size-3.5" aria-hidden />
        </Link>
        <button type="button" aria-label={`Excluir ${dashboard.name}`} title="Excluir" onClick={onDelete} className={round}>
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </div>
    </article>
  );
};

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
      <AppHeader />

      <main className="px-4 py-8 sm:px-10 sm:py-10 lg:px-30">
        <PageHeading
          title="Dashboards"
          description="Painéis da sua conta, com dados ao vivo dos datasets."
          actions={
            <Button onClick={handleCreate}>
              <Plus aria-hidden />
              Novo dashboard
            </Button>
          }
        />
        {!hydrated ? (
          <CardSkeletons count={3} itemClassName="aspect-[3/2] h-auto rounded-2xl" />
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
              <DashboardCard
                key={dashboard.id}
                dashboard={dashboard}
                isPublic={Boolean(shareTokens[dashboard.id])}
                onDelete={() =>
                  void confirmAction({
                    title: `Excluir "${dashboard.name}"?`,
                    description: "Esta ação não pode ser desfeita.",
                    confirmLabel: "Excluir",
                    destructive: true,
                  }).then((ok) => ok && deleteDashboard(dashboard.id))
                }
              />
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
