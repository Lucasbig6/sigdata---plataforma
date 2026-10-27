"use client";

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowLeftRight,
  ArrowUpDown,
  Group,
  LayoutDashboard,
  Ungroup,
  type LucideIcon,
} from "lucide-react";
import { useDashboardsStore } from "@/lib/dashboards/store";

const Btn = ({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className="grid size-7 place-items-center rounded-md text-foreground transition-colors hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
  >
    <Icon className="size-3.5" aria-hidden />
  </button>
);

const Sep = () => <span className="mx-0.5 h-4 w-px bg-border/70" />;

/**
 * Alinhar, distribuir, igualar tamanho, agrupar e organizar. Com um elemento
 * alinha à página; com vários, entre si.
 */
export const ArrangeToolbar = () => {
  const count = useDashboardsStore((state) => state.selectedIds.length);
  const grouped = useDashboardsStore((state) => {
    const doc = state.currentId ? state.dashboards[state.currentId] : undefined;
    return Boolean(doc?.elements.some((el) => state.selectedIds.includes(el.id) && el.groupId));
  });
  const hasElements = useDashboardsStore((state) =>
    Boolean(state.currentId && state.dashboards[state.currentId]?.elements.length),
  );
  const align = useDashboardsStore((state) => state.alignSelected);
  const distribute = useDashboardsStore((state) => state.distributeSelected);
  const matchSize = useDashboardsStore((state) => state.matchSelectedSize);
  const group = useDashboardsStore((state) => state.groupSelected);
  const ungroup = useDashboardsStore((state) => state.ungroupSelected);
  const arrange = useDashboardsStore((state) => state.arrange);

  const target = count > 1 ? "entre si" : "à página";
  const any = count > 0;

  return (
    <div
      role="toolbar"
      aria-label="Organizar elementos"
      className="flex items-center gap-0.5 rounded-lg border border-border/70 bg-popover/90 p-1 shadow-sm backdrop-blur"
    >
      <Btn icon={AlignStartVertical} label={`Alinhar à esquerda (${target})`} disabled={!any} onClick={() => align("left")} />
      <Btn icon={AlignCenterVertical} label={`Centralizar na horizontal (${target})`} disabled={!any} onClick={() => align("center")} />
      <Btn icon={AlignEndVertical} label={`Alinhar à direita (${target})`} disabled={!any} onClick={() => align("right")} />
      <Sep />
      <Btn icon={AlignStartHorizontal} label={`Alinhar ao topo (${target})`} disabled={!any} onClick={() => align("top")} />
      <Btn icon={AlignCenterHorizontal} label={`Centralizar na vertical (${target})`} disabled={!any} onClick={() => align("middle")} />
      <Btn icon={AlignEndHorizontal} label={`Alinhar à base (${target})`} disabled={!any} onClick={() => align("bottom")} />
      <Sep />
      <Btn icon={AlignHorizontalDistributeCenter} label="Distribuir na horizontal (3 ou mais)" disabled={count < 3} onClick={() => distribute("horizontal")} />
      <Btn icon={AlignVerticalDistributeCenter} label="Distribuir na vertical (3 ou mais)" disabled={count < 3} onClick={() => distribute("vertical")} />
      <Btn icon={ArrowLeftRight} label="Igualar largura" disabled={count < 2} onClick={() => matchSize("w")} />
      <Btn icon={ArrowUpDown} label="Igualar altura" disabled={count < 2} onClick={() => matchSize("h")} />
      <Sep />
      <Btn icon={Group} label="Agrupar (Ctrl+G)" disabled={count < 2} onClick={group} />
      <Btn icon={Ungroup} label="Desagrupar (Ctrl+Shift+G)" disabled={!grouped} onClick={ungroup} />
      <Sep />
      <Btn icon={LayoutDashboard} label="Organizar automaticamente" disabled={!hasElements} onClick={arrange} />
    </div>
  );
};
