"use client";

import { Eye, LayoutDashboard, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { confirmAction } from "@/lib/feedback";

const formatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

/** Ids dos dashboards criados a partir do projeto, mais recentes primeiro (seletor estável para o contador da aba). */
export const useProjectDashboardIds = (notebookId: string | null): string[] => {
  const order = useDashboardsStore((state) => state.order);
  const dashboards = useDashboardsStore((state) => state.dashboards);
  const projectIds = useDashboardsStore((state) => state.projectIds);
  return useMemo(
    () =>
      notebookId
        ? order
            .filter((id) => projectIds[id] === notebookId && dashboards[id])
            .sort((a, b) => dashboards[b]!.updatedAt - dashboards[a]!.updatedAt)
        : [],
    [order, dashboards, projectIds, notebookId],
  );
};

/** Aba "Dashboards" do estúdio: os dashboards do projeto, para abrir, visualizar, excluir ou criar outro. */
export const ProjectDashboardsPanel = ({
  notebookId,
  onCreateFromVisualizations,
  visualizationCount,
}: {
  notebookId: string;
  /** Monta um dashboard com as visualizações salvas do projeto. */
  onCreateFromVisualizations: () => void;
  visualizationCount: number;
}) => {
  const router = useRouter();
  const hydrate = useDashboardsStore((state) => state.hydrate);
  const hydrated = useDashboardsStore((state) => state.hydrated);
  const dashboards = useDashboardsStore((state) => state.dashboards);
  const createDashboard = useDashboardsStore((state) => state.createDashboard);
  const deleteDashboard = useDashboardsStore((state) => state.deleteDashboard);
  const ids = useProjectDashboardIds(notebookId);

  useEffect(() => hydrate(), [hydrate]);

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="xs" variant="outline" onClick={() => router.push(`/dashboards/${createDashboard(notebookId)}`)}>
          <Plus className="size-3.5" aria-hidden />
          Novo dashboard
        </Button>
        {visualizationCount > 0 ? (
          <Button size="xs" variant="outline" onClick={onCreateFromVisualizations}>
            <LayoutDashboard className="size-3.5" aria-hidden />
            Com as visualizações salvas
          </Button>
        ) : null}
      </div>

      {!hydrated ? (
        <p className="px-1 text-xs text-muted-foreground">Carregando dashboards…</p>
      ) : ids.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
            <LayoutDashboard className="size-5" aria-hidden />
          </span>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Nenhum dashboard neste projeto ainda. Crie um em branco ou monte um com as visualizações salvas.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {ids.map((id) => {
            const dashboard = dashboards[id]!;
            const elements = (dashboard.pages ?? [dashboard]).reduce((sum, page) => sum + page.elements.length, 0);
            return (
              <li key={id} className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
                <Link
                  href={`/dashboards/${id}`}
                  className="min-w-0 flex-1 rounded-lg px-2.5 py-1.5 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <span className="block truncate text-sm font-medium text-foreground">{dashboard.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {elements} {elements === 1 ? "elemento" : "elementos"} · {formatDate(dashboard.updatedAt)}
                  </span>
                </Link>
                <Link
                  href={`/dashboards/${id}?preview=1`}
                  aria-label={`Visualizar ${dashboard.name}`}
                  title="Visualizar"
                  className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <Eye className="size-4" aria-hidden />
                </Link>
                <button
                  type="button"
                  aria-label={`Excluir ${dashboard.name}`}
                  title="Excluir"
                  onClick={() =>
                    void confirmAction({
                      title: `Excluir "${dashboard.name}"?`,
                      description: "Esta ação não pode ser desfeita.",
                      confirmLabel: "Excluir",
                      destructive: true,
                    }).then((ok) => ok && deleteDashboard(id))
                  }
                  className="me-1 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
