"use client";

import type { ColumnProfile, ResultColumn } from "@/lib/domain/sources";
import { KIND_LABELS } from "./form-helpers";

const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });

/** Visão de esquema: uma linha por coluna, com tipo e qualidade (nulos, distintos, mínimo, máximo). */
export const SchemaView = ({
  columns,
  profile,
  selected,
  onSelect,
}: {
  columns: ResultColumn[];
  profile: Record<string, ColumnProfile>;
  selected: string | null;
  onSelect: (name: string) => void;
}) => (
  <div className="h-full overflow-auto">
    <table className="w-full border-separate border-spacing-0 text-sm">
      <thead className="sticky top-0 z-10 bg-muted text-left text-xs text-muted-foreground">
        <tr>
          {["Coluna", "Tipo", "Nulos", "Distintos", "Mínimo", "Máximo", "Média"].map((title) => (
            <th key={title} className="border-b border-border px-3 py-1.5 font-medium">
              {title}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {columns.map((column) => {
          const stats = profile[column.name];
          return (
            <tr
              key={column.name}
              onClick={() => onSelect(column.name)}
              aria-selected={selected === column.name}
              className={`cursor-pointer hover:bg-muted/50 ${selected === column.name ? "bg-primary/10" : ""}`}
            >
              <td className="border-b border-border/60 px-3 py-1.5 font-medium">{column.name}</td>
              <td className="border-b border-border/60 px-3 py-1.5 text-muted-foreground">
                {KIND_LABELS[column.kind]} <span className="text-[10px]">({column.dbType.toLowerCase()})</span>
              </td>
              <td className="border-b border-border/60 px-3 py-1.5 tabular-nums">{stats ? `${nf.format(stats.nulos)} (${stats.nulosPct}%)` : "—"}</td>
              <td className="border-b border-border/60 px-3 py-1.5 tabular-nums">{stats?.distintos != null ? nf.format(stats.distintos) : "—"}</td>
              <td className="max-w-40 truncate border-b border-border/60 px-3 py-1.5 tabular-nums">{stats?.min ?? "—"}</td>
              <td className="max-w-40 truncate border-b border-border/60 px-3 py-1.5 tabular-nums">{stats?.max ?? "—"}</td>
              <td className="border-b border-border/60 px-3 py-1.5 tabular-nums">{stats?.media != null ? nf.format(stats.media) : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
