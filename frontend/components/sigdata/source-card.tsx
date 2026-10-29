"use client";

import { ChevronDown, Code2, Database, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { useCan } from "@/lib/auth-client";
import { DATASET_KIND_LABELS } from "@/lib/datasets/store";
import type { DataSource, SourceColumn, TablePreview } from "@/lib/domain/sources";
import { sourceSummary } from "@/lib/workspace/suggestions";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<SourceColumn["kind"], string> = {
  numero: "123",
  texto: "Abc",
  data: "Data",
  booleano: "V/F",
  outro: "?",
};

const SAMPLE_ROWS = 5;

const cellText = (value: unknown) =>
  typeof value === "number"
    ? value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
    : value == null
      ? "—"
      : String(value);

const Sample = ({ sourceId, table }: { sourceId: string; table: string }) => {
  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: TablePreview }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    api<TablePreview>(`/api/sources/${sourceId}/preview?table=${encodeURIComponent(table)}`)
      .then((data) => !cancelled && setState({ status: "ready", data }))
      .catch((error: Error) => !cancelled && setState({ status: "error", message: error.message }));
    return () => {
      cancelled = true;
    };
  }, [sourceId, table]);

  if (state.status === "loading") {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin" aria-hidden /> Carregando amostra…
      </p>
    );
  }
  if (state.status === "error") return <p className="text-[11px] text-destructive">{state.message}</p>;

  const { columns, rows } = state.data;
  return (
    <div className="max-h-44 overflow-auto rounded-md border border-border">
      <table className="w-full text-[11px]">
        <thead className="sticky top-0 bg-muted/80">
          <tr>
            {columns.map((column) => (
              <th key={column.name} className="whitespace-nowrap px-2 py-1 text-left font-medium text-muted-foreground">
                {column.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, SAMPLE_ROWS).map((row, index) => (
            <tr key={index} className="border-t border-border/60">
              {columns.map((column) => (
                <td key={column.name} className="whitespace-nowrap px-2 py-1 text-foreground">
                  {cellText(row[column.name])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const TableBlock = ({ source, tableName }: { source: DataSource; tableName: string }) => {
  const table = source.tables.find((entry) => entry.name === tableName);
  const [showSample, setShowSample] = useState(false);
  if (!table) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground" title={table.name}>
          {table.name}
          {table.rowCount != null ? (
            <span className="ms-1.5 font-normal text-muted-foreground">
              {table.rowCount.toLocaleString("pt-BR")} linhas
            </span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => setShowSample((value) => !value)}
          aria-expanded={showSample}
          className="shrink-0 text-[11px] font-medium text-primary hover:underline"
        >
          {showSample ? "Ocultar amostra" : "Ver amostra"}
        </button>
      </div>
      <ul className="flex flex-wrap gap-1">
        {table.columns.map((column) => (
          <li
            key={column.name}
            title={`${column.name} (${column.dbType})`}
            className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-foreground"
          >
            <span className="shrink-0 text-[9px] font-semibold text-muted-foreground">{KIND_LABEL[column.kind]}</span>
            <span className="truncate">{column.name}</span>
          </li>
        ))}
      </ul>
      {showSample ? <Sample sourceId={source.id} table={table.name} /> : null}
    </div>
  );
};

/** Fonte ativa do projeto: o que existe nela, para o usuário saber o que perguntar. */
export const SourceCard = ({ source }: { source: DataSource | null }) => {
  const [open, setOpen] = useState(true);
  const canManageSources = useCan("analista");

  if (!source) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border bg-card/40 px-3 py-2.5">
        <Database className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">
          Nenhum dataset neste projeto. Escolha um na barra lateral.
        </p>
        {canManageSources ? (
          <Link
            href="/fontes-de-dados/editor"
            className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            <Code2 className="size-3" aria-hidden />
            Criar dataset
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm" aria-label="Fonte de dados">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
          <Database className="size-3.5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-foreground">{source.name}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {DATASET_KIND_LABELS[source.kind]} · {sourceSummary(source.tables)}
          </span>
        </span>
        <ChevronDown
          className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="max-h-80 space-y-3 overflow-y-auto border-t border-border px-3 py-3">
          {source.description ? <p className="text-[11px] leading-snug text-muted-foreground">{source.description}</p> : null}
          {source.tables.slice(0, 8).map((table) => (
            <TableBlock key={table.name} source={source} tableName={table.name} />
          ))}
          {source.tables.length > 8 ? (
            <p className="text-[11px] text-muted-foreground">… e mais {source.tables.length - 8} tabelas.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
