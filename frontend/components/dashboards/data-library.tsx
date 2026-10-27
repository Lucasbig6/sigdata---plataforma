"use client";

import { Calendar, ChevronRight, Database, Hash, Table as TableIcon, ToggleLeft, Type } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { draftFromColumn } from "@/lib/dashboards/auto-binding";
import { FIELD_MIME, type DraggedField } from "@/lib/dashboards/field-drop";
import { findLibraryItem } from "@/lib/dashboards/presets";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { useDatasetsStore } from "@/lib/datasets/store";
import type { ColumnKind, DataSource } from "@/lib/domain/sources";

const KIND_ICON: Record<ColumnKind, typeof Type> = {
  numero: Hash,
  texto: Type,
  data: Calendar,
  booleano: ToggleLeft,
  outro: Type,
};

type AddFromSource = (source: DataSource, tableName: string, columnName?: string) => void;

const useAddFromSource = (): AddFromSource => {
  const addElement = useDashboardsStore((state) => state.addElement);
  return (source, tableName, columnName) => {
    const table = source.tables.find((entry) => entry.name === tableName);
    if (!table) return;
    const column = table.columns.find((entry) => entry.name === columnName);
    const draft = draftFromColumn(source, table, column);
    const item = findLibraryItem(draft.itemKey);
    if (item) addElement(item, undefined, draft.props);
  };
};

const columnHint = (kind: ColumnKind) =>
  kind === "numero"
    ? "Adicionar soma como indicador"
    : kind === "data"
      ? "Adicionar gráfico de linha por esta coluna"
      : "Adicionar gráfico de barras por esta coluna";

const SourceTree = ({ source, onAdd }: { source: DataSource; onAdd: AddFromSource }) => {
  const [open, setOpen] = useState<string | null>(source.tables[0]?.name ?? null);
  return (
    <ul className="space-y-0.5">
      {source.tables.map((table) => {
        const expanded = open === table.name;
        return (
          <li key={table.name}>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-expanded={expanded}
                aria-label={`${expanded ? "Recolher" : "Expandir"} ${table.name}`}
                onClick={() => setOpen(expanded ? null : table.name)}
                className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted/60"
              >
                <ChevronRight className={`size-3 transition-transform ${expanded ? "rotate-90" : ""}`} aria-hidden />
              </button>
              <button
                type="button"
                title="Adicionar tabela à página"
                onClick={() => onAdd(source, table.name)}
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1 text-left text-[11px] font-medium text-foreground hover:bg-muted/60"
              >
                <TableIcon className="size-3.5 shrink-0 text-primary" aria-hidden />
                <span className="truncate">{table.name}</span>
              </button>
            </div>
            {expanded ? (
              <ul className="ml-6 border-l border-border/60 pl-1.5">
                {table.columns.map((column) => {
                  const Icon = KIND_ICON[column.kind];
                  return (
                    <li key={column.name}>
                      <button
                        type="button"
                        draggable
                        onDragStart={(event) => {
                          const field: DraggedField = {
                            sourceId: source.id,
                            table: table.name,
                            column: column.name,
                            kind: column.kind,
                          };
                          event.dataTransfer.setData(FIELD_MIME, JSON.stringify(field));
                          event.dataTransfer.effectAllowed = "copy";
                        }}
                        title={`${columnHint(column.kind)} — ou arraste para a página / sobre um gráfico`}
                        onClick={() => onAdd(source, table.name, column.name)}
                        className="flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      >
                        <Icon className="size-3 shrink-0" aria-hidden />
                        <span className="truncate font-mono">{column.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
};

/** Fontes → tabelas → colunas: clicar monta o elemento já ligado aos dados. */
export const DataLibrary = () => {
  const datasets = useDatasetsStore((state) => state.datasets);
  const hydrated = useDatasetsStore((state) => state.hydrated);
  const error = useDatasetsStore((state) => state.error);
  const add = useAddFromSource();
  const ready = datasets.filter((source) => source.status === "pronta" && source.tables.length > 0);

  if (!hydrated) return <p className="p-3 text-[11px] text-muted-foreground">Carregando fontes…</p>;
  if (error) return <p className="p-3 text-[11px] text-destructive">{error}</p>;
  if (ready.length === 0) {
    return (
      <p className="p-3 text-[11px] leading-snug text-muted-foreground">
        Nenhuma fonte pronta.{" "}
        <Link href="/fontes-de-dados" className="text-primary hover:underline">
          Conectar uma fonte
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-4 p-3">
      <p className="text-[10px] leading-snug text-muted-foreground">
        Clique numa tabela para exibi-la, numa coluna numérica para somar (indicador) ou numa coluna de
        categoria/data para agrupar (gráfico).
      </p>
      {ready.map((source) => (
        <section key={source.id}>
          <p className="mb-1 flex items-center gap-1.5 truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Database className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{source.name}</span>
          </p>
          <SourceTree source={source} onAdd={add} />
        </section>
      ))}
    </div>
  );
};
