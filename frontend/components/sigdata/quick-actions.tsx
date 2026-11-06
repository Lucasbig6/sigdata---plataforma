"use client";

import { ArrowRight, FileSpreadsheet, LayoutDashboard, MessageSquare, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { useNotebooksStore } from "@/lib/notebooks/store";
import { projectHref } from "@/lib/routes";

const Action = ({
  icon: Icon,
  title,
  hint,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3 text-start outline-none transition-colors hover:border-primary/40 hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/40"
  >
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
      <Icon className="size-5" aria-hidden />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-medium leading-tight text-foreground">{title}</span>
      <span className="block truncate text-xs text-muted-foreground">{hint}</span>
    </span>
    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
  </button>
);

/** Atalhos pelo que a pessoa quer fazer: retomar, trazer dados novos ou montar um dashboard. */
export const QuickActions = () => {
  const router = useRouter();
  const notebooks = useNotebooksStore((state) => state.notebooks);
  const createNotebook = useNotebooksStore((state) => state.createNotebook);
  const createDashboard = useDashboardsStore((state) => state.createDashboard);
  const latest = [...notebooks].sort((a, b) => b.updatedAt - a.updatedAt)[0];

  return (
    <section aria-label="Atalhos" className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {latest ? (
        <Action
          icon={MessageSquare}
          title="Continuar de onde parei"
          hint={latest.title}
          onClick={() => router.push(projectHref(latest.id))}
        />
      ) : (
        <Action icon={MessageSquare} title="Fazer uma pergunta" hint="Comece um projeto novo" onClick={() => router.push(projectHref(createNotebook()))} />
      )}
      <Action
        icon={FileSpreadsheet}
        title="Analisar uma planilha"
        hint="Envie um CSV ou Excel e pergunte"
        onClick={() => router.push(projectHref(createNotebook()))}
      />
      <Action
        icon={LayoutDashboard}
        title="Montar um dashboard"
        hint="Comece em branco ou a partir de um projeto"
        onClick={() => router.push(`/dashboards/${createDashboard()}`)}
      />
    </section>
  );
};
