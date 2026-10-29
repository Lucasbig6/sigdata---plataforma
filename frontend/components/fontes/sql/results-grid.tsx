"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ResultColumn } from "@/lib/domain/sources";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 });

const csvCell = (value: unknown) => {
  if (value == null) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const PAGE_SIZES = [25, 50, 100, 200, 500, 1000] as const;

export const downloadCsv = (name: string, columns: ResultColumn[], rows: Record<string, unknown>[]) => {
  const lines = [
    columns.map((c) => csvCell(c.name)).join(";"),
    ...rows.map((row) => columns.map((c) => csvCell(row[c.name])).join(";")),
  ];
  // BOM para o Excel reconhecer UTF-8
  const blob = new Blob([`﻿${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name.replace(/[^\w-]+/g, "_") || "resultado"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const Cell = ({ value, kind }: { value: unknown; kind: ResultColumn["kind"] }) => {
  if (value == null) return <span className="text-muted-foreground/60 italic">NULL</span>;
  if (typeof value === "number") return <>{nf.format(value)}</>;
  if (typeof value === "boolean") return <span className="text-[var(--sql-number)]">{String(value)}</span>;
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return <span className={cn(kind === "numero" && "tabular-nums")}>{text}</span>;
};

export type Pagination = {
  page: number;
  pageSize: number;
  /** Total de linhas do resultado (null enquanto desconhecido). */
  total: number | null;
  hasMore: boolean;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
};

const nfInt = new Intl.NumberFormat("pt-BR");

const PageInput = ({ page, last, onCommit }: { page: number; last: number | null; onCommit: (page: number) => void }) => {
  const [draft, setDraft] = useState(String(page));
  useEffect(() => setDraft(String(page)), [page]);

  const commit = () => {
    const next = Math.floor(Number(draft));
    if (!Number.isFinite(next) || next < 1) return setDraft(String(page));
    const clamped = last ? Math.min(next, last) : next;
    setDraft(String(clamped));
    if (clamped !== page) onCommit(clamped);
  };

  return (
    <input
      value={draft}
      inputMode="numeric"
      aria-label="Ir para a página"
      onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
        if (event.key === "Escape") setDraft(String(page));
      }}
      className="h-6 w-12 rounded border border-border bg-background px-1 text-center text-xs text-foreground tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    />
  );
};

const NavButton = ({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={onClick}
    className="grid size-6 place-items-center rounded text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-35"
  >
    {children}
  </button>
);

/** Grade de resultados no estilo de clientes SQL: nº da linha, cabeçalho fixo, tipos, NULL em destaque e paginação. */
export const ResultsGrid = ({
  columns,
  rows,
  title,
  pagination,
  loading,
}: {
  columns: ResultColumn[];
  rows: Record<string, unknown>[];
  title: string;
  pagination: Pagination;
  loading: boolean;
}) => {
  const { page, pageSize, total, hasMore, onPage, onPageSize } = pagination;
  const offset = (page - 1) * pageSize;
  const last = total != null ? Math.max(1, Math.ceil(total / pageSize)) : null;
  const canNext = last != null ? page < last : hasMore;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("min-h-0 flex-1 overflow-auto transition-opacity", loading && "pointer-events-none opacity-50")}>
        <table className="w-max min-w-full border-separate border-spacing-0 font-mono text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 w-12 border-b border-r border-border bg-muted px-2 py-1.5 text-right font-normal text-muted-foreground">
                #
              </th>
              {columns.map((column) => (
                <th
                  key={column.name}
                  title={`${column.name} · ${column.dbType}`}
                  className="border-b border-r border-border bg-muted px-3 py-1.5 text-left font-semibold whitespace-nowrap text-foreground"
                >
                  {column.name}
                  <span className="ms-1.5 text-[10px] font-normal text-muted-foreground">{column.dbType.toLowerCase()}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={offset + index} className="group hover:bg-primary/5">
                <td className="sticky left-0 border-b border-r border-border bg-muted/70 px-2 py-1 text-right text-muted-foreground tabular-nums">
                  {nfInt.format(offset + index + 1)}
                </td>
                {columns.map((column) => (
                  <td
                    key={column.name}
                    className={cn(
                      "max-w-96 truncate border-b border-r border-border/60 px-3 py-1 whitespace-nowrap",
                      column.kind === "numero" && "text-right",
                      index % 2 === 1 && "bg-muted/20",
                    )}
                    title={row[column.name] == null ? "NULL" : String(row[column.name])}
                  >
                    <Cell value={row[column.name]} kind={column.kind} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
        <Button size="xs" variant="ghost" onClick={() => downloadCsv(`${title}-pagina-${page}`, columns, rows)}>
          <Download aria-hidden />
          Exportar página (CSV)
        </Button>

        <span className="ms-auto tabular-nums" aria-live="polite">
          {rows.length > 0
            ? `Linhas ${nfInt.format(offset + 1)}–${nfInt.format(offset + rows.length)}${total != null ? ` de ${nfInt.format(total)}` : hasMore ? "+" : ""}`
            : "Sem linhas nesta página"}
        </span>

        <label className="flex items-center gap-1.5">
          Linhas por página
          <select
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value))}
            className="h-6 rounded border border-border bg-background px-1 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <nav aria-label="Paginação" className="flex items-center gap-0.5">
          <NavButton label="Primeira página" disabled={page <= 1 || loading} onClick={() => onPage(1)}>
            <ChevronsLeft className="size-3.5" aria-hidden />
          </NavButton>
          <NavButton label="Página anterior" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}>
            <ChevronLeft className="size-3.5" aria-hidden />
          </NavButton>
          <span className="mx-1 flex items-center gap-1.5">
            Página <PageInput page={page} last={last} onCommit={onPage} />
            {last != null ? <span className="tabular-nums">de {nfInt.format(last)}</span> : null}
          </span>
          <NavButton label="Próxima página" disabled={!canNext || loading} onClick={() => onPage(page + 1)}>
            <ChevronRight className="size-3.5" aria-hidden />
          </NavButton>
          <NavButton label="Última página" disabled={last == null || page >= last || loading} onClick={() => last && onPage(last)}>
            <ChevronsRight className="size-3.5" aria-hidden />
          </NavButton>
        </nav>
      </div>
    </div>
  );
};
