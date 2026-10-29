"use client";

import { Database, FolderKanban, LayoutDashboard, Table2, Users } from "lucide-react";
import type { ComponentType } from "react";
import type { AdminOverview } from "@shared/domain/admin";
import { ROLE_LABELS, ROLES } from "@shared/domain/roles";

const Stat = ({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  detail?: string;
}) => (
  <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card px-4 py-3.5">
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
    <span className="text-2xl font-semibold tabular-nums text-foreground">{value.toLocaleString("pt-BR")}</span>
    {detail ? <span className="truncate text-[11px] text-muted-foreground">{detail}</span> : null}
  </div>
);

/** Visão geral do sistema: contas por papel e o que existe na plataforma. */
export const OverviewCards = ({ overview }: { overview: AdminOverview | null }) => {
  if (!overview) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl bg-muted/50" />
        ))}
      </div>
    );
  }

  const byRole = [...ROLES]
    .reverse()
    .map((role) => `${overview.users[role]} ${ROLE_LABELS[role].toLowerCase()}`)
    .join(" · ");

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Stat
        icon={Users}
        label="Usuários"
        value={overview.users.total}
        detail={overview.users.banned > 0 ? `${byRole} · ${overview.users.banned} desativado(s)` : byRole}
      />
      <Stat icon={Database} label="Fontes de dados" value={overview.sources} detail="Arquivos e bancos" />
      <Stat icon={Table2} label="Datasets" value={overview.datasets} detail="Criados no editor SQL" />
      <Stat icon={FolderKanban} label="Projetos" value={overview.projects} />
      <Stat
        icon={LayoutDashboard}
        label="Painéis"
        value={overview.dashboards}
        detail={`${overview.sharedDashboards} com link público`}
      />
    </div>
  );
};
