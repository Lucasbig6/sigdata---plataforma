"use client";

import { ChevronRight, Database, Play, Search, Table2 } from "lucide-react";
import { useMemo, useState } from "react";
import { DATASET_KIND_LABELS } from "@/lib/datasets/store";
import type { DataSource, SourceColumn } from "@/lib/domain/sources";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<SourceColumn["kind"], string> = {
  numero: "123",
  texto: "Abc",
  data: "Data",
  booleano: "V/F",
  outro: "?",
};

const SIMPLE = /^[a-z_][a-z0-9_]*$/;
const ident = (name: string) => (SIMPLE.test(name) ? name : `"${name}"`);

/** Navegador de objetos da fonte (como a árvore do DBeaver): filtro, tabelas e colunas com tipo. */
export const SchemaNavigator = ({
  source,
  onInsert,
  onPreview,
}: {
  source: DataSource;
  onInsert: (text: string) => void;
  /** Abre `SELECT * FROM tabela LIMIT 100` num script novo e executa. */
  onPreview: (table: string) => void;
}) => {
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set(source.tables.length <= 3 ? source.tables.map((t) => t.name) : []));

  const term = filter.trim().toLowerCase();
  const tables = useMemo(
    () =>
      source.tables
        .map((table) => {
          const tableMatch = table.name.toLowerCase().includes(term);
          const columns = table.columns.filter((c) => c.name.toLowerCase().includes(term));
          return { table, columns: tableMatch || !term ? table.columns : columns, show: !term || tableMatch || columns.length > 0 };
        })
        .filter((entry) => entry.show),
    [source.tables, term],
  );

  const toggle = (name: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(name)) next.add(name);
      return next;
    });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-border p-2.5">
        <div className="flex items-center gap-2 text-xs">
          <Database className="size-3.5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1 truncate font-medium text-foreground" title={source.name}>
            {source.name}
          </span>
          <span className="shrink-0 rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {DATASET_KIND_LABELS[source.kind]}
          </span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute start-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filtrar tabelas e colunas"
            aria-label="Filtrar tabelas e colunas"
            className="h-7 w-full rounded-md border border-border bg-background ps-7 pe-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto p-1.5 text-xs">
        {tables.length === 0 ? <li className="px-2 py-3 text-muted-foreground">Nada encontrado.</li> : null}
        {tables.map(({ table, columns }) => {
          const expanded = Boolean(term) || open.has(table.name);
          return (
            <li key={table.name}>
              <div className="group flex items-center gap-1 rounded-md hover:bg-muted">
                <button
                  type="button"
                  onClick={() => toggle(table.name)}
                  onDoubleClick={() => onInsert(table.name.split(".").map(ident).join("."))}
                  aria-expanded={expanded}
                  title="Clique para expandir · duplo clique insere o nome"
                  className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-1 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <ChevronRight className={cn("size-3 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")} aria-hidden />
                  <Table2 className="size-3.5 shrink-0 text-primary/80" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{table.name}</span>
                  {table.rowCount != null ? (
                    <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{table.rowCount.toLocaleString("pt-BR")}</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => onPreview(table.name)}
                  title={`Ver as primeiras linhas de ${table.name}`}
                  aria-label={`Ver as primeiras linhas de ${table.name}`}
                  className="me-1 grid size-5 shrink-0 place-items-center rounded text-muted-foreground opacity-0 outline-none transition-opacity group-hover:opacity-100 hover:text-primary focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <Play className="size-3" aria-hidden />
                </button>
              </div>
              {expanded ? (
                <ul className="ms-3.5 border-s border-border/70 ps-1">
                  {columns.map((column) => (
                    <li key={column.name}>
                      <button
                        type="button"
                        onClick={() => onInsert(ident(column.name))}
                        title={`${column.name} · ${column.dbType}${column.profile ? ` · ${column.profile.nulosPct}% nulos` : ""}`}
                        className="flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-start text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <span className="w-7 shrink-0 text-[9px] font-semibold text-primary/70">{KIND_LABEL[column.kind]}</span>
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{column.name}</span>
                        <span className="shrink-0 text-[9px] opacity-60">{column.dbType.toLowerCase()}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
