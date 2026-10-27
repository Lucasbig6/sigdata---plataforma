"use client";

import { FilterX } from "lucide-react";
import { useDashboardData } from "@/lib/dashboards/live-data";

/** Aparece quando há filtros ou seleções de gráficos ativos e limpa todos de uma vez. */
export const ClearFilters = ({ className = "" }: { className?: string }) => {
  const { hasActiveFilters, clearAll } = useDashboardData();
  if (!hasActiveFilters) return null;
  return (
    <button
      type="button"
      onClick={clearAll}
      className={`flex items-center gap-1.5 rounded-md border border-border/70 bg-popover/90 px-2 py-1.5 text-[11px] font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted/60 ${className}`}
    >
      <FilterX className="size-3.5 text-primary" aria-hidden />
      Limpar filtros
    </button>
  );
};
