"use client";

import { Database, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { autoProps, defaultSource } from "@/lib/dashboards/auto-binding";
import { ELEMENT_LIBRARY, ELEMENT_MIME, type LibraryItem } from "@/lib/dashboards/presets";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { useDatasetsStore } from "@/lib/datasets/store";

/** Adiciona um item já ligado a uma fonte real, quando houver. */
export const useAddLibraryItem = () => {
  const addElement = useDashboardsStore((state) => state.addElement);
  const datasets = useDatasetsStore((state) => state.datasets);
  return (item: LibraryItem, placement?: { x?: number; y?: number }) =>
    addElement(item, placement, autoProps(item.type, datasets));
};

export const ElementLibrary = () => {
  const add = useAddLibraryItem();
  const datasets = useDatasetsStore((state) => state.datasets);
  const [query, setQuery] = useState("");
  const source = defaultSource(datasets);
  const normalized = query.trim().toLowerCase();

  const groups = ELEMENT_LIBRARY.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        !normalized ||
        item.label.toLowerCase().includes(normalized) ||
        item.description.toLowerCase().includes(normalized),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <aside className="hidden w-64 shrink-0 flex-col overflow-hidden border-r border-border/60 bg-card/40 lg:flex">
      <div className="space-y-2 border-b border-border/60 px-3 py-3">
        <div>
          <p className="text-xs font-semibold text-foreground">Elementos</p>
          <p className="text-[10px] text-muted-foreground">Clique ou arraste para a página</p>
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute start-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar elemento"
            aria-label="Buscar elemento"
            className="h-8 w-full rounded-md border border-border/70 bg-background ps-7 pe-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {groups.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Nenhum elemento encontrado.</p>
        ) : null}
        {groups.map((group) => (
          <section key={group.id}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {group.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  draggable
                  title={item.description}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(ELEMENT_MIME, item.key);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => add(item)}
                  className="group flex flex-col items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-1.5 py-2.5 text-center transition-colors hover:border-primary/50 hover:bg-muted/50 active:bg-muted"
                >
                  <span className="grid size-8 place-items-center rounded-md bg-muted/70 text-primary transition-colors group-hover:bg-primary/10">
                    <item.icon className="size-4" aria-hidden />
                  </span>
                  <span className="line-clamp-2 text-[11px] leading-tight font-medium text-foreground">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="border-t border-border/60 px-3 py-2.5">
        {source ? (
          <p className="flex items-start gap-1.5 text-[10px] leading-snug text-muted-foreground">
            <Database className="mt-px size-3 shrink-0 text-primary" aria-hidden />
            <span>
              Novos elementos usam <span className="font-medium text-foreground">{source.name}</span>.
              Troque em Propriedades → Dados.
            </span>
          </p>
        ) : (
          <p className="text-[10px] leading-snug text-muted-foreground">
            Nenhuma fonte de dados.{" "}
            <Link href="/fontes-de-dados" className="text-primary underline-offset-2 hover:underline">
              Conectar uma fonte
            </Link>{" "}
            para ver dados reais.
          </p>
        )}
      </div>
    </aside>
  );
};
