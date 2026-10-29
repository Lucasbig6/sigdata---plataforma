"use client";

import { Database, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { autoProps, defaultSource } from "@/lib/dashboards/auto-binding";
import { ELEMENT_LIBRARY, ELEMENT_MIME, type LibraryItem } from "@/lib/dashboards/presets";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { useCan } from "@/lib/auth-client";
import { useDatasetsStore } from "@/lib/datasets/store";
import { panelSources } from "@/lib/domain/sources";
import { WorkspaceLibrary } from "./workspace-library";

/** Adiciona um item já ligado a uma fonte real, quando houver. */
export const useAddLibraryItem = () => {
  const addElement = useDashboardsStore((state) => state.addElement);
  const datasets = useDatasetsStore((state) => state.datasets);
  const preferredSourceId = useDashboardsStore((state) => state.preferredSourceId);
  return (item: LibraryItem, placement?: { x?: number; y?: number }) =>
    addElement(
      item,
      placement,
      autoProps(
        item.type,
        datasets,
        preferredSourceId,
        item.defaultProps().mode === "range" ? "range" : "list",
      ),
    );
};

type Tab = "visualizacoes" | "elementos";

const TABS: { id: Tab; label: string }[] = [
  { id: "visualizacoes", label: "Visualizações" },
  { id: "elementos", label: "Elementos" },
];

export const ElementLibrary = () => {
  const add = useAddLibraryItem();
  const datasets = useDatasetsStore((state) => state.datasets);
  const canManageSources = useCan("analista");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("visualizacoes");
  const preferredSourceId = useDashboardsStore((state) => state.preferredSourceId);
  const setPreferredSourceId = useDashboardsStore((state) => state.setPreferredSourceId);
  const readySources = panelSources(datasets);
  const source = defaultSource(datasets, preferredSourceId);
  const normalized = query.trim().toLowerCase();

  // gráficos, tabelas e indicadores vêm só das visualizações salvas (aba Visualizações)
  const groups = ELEMENT_LIBRARY.filter((group) => !group.fromAnalysis).map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        !normalized ||
        item.label.toLowerCase().includes(normalized) ||
        item.description.toLowerCase().includes(normalized),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <aside className="hidden w-72 shrink-0 flex-col overflow-hidden border-r border-border/60 bg-card/40 lg:flex">
      <div role="tablist" className="flex gap-1 border-b border-border/60 px-3 py-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              tab === t.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "visualizacoes" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <WorkspaceLibrary />
        </div>
      ) : null}

      {tab === "elementos" ? (
      <>
      <div className="space-y-2 border-b border-border/60 px-3 py-3">
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
        <p className="text-[10px] text-muted-foreground">Filtros, textos e formas. Clique ou arraste para a página.</p>
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
      </>
      ) : null}

      {tab === "elementos" ? (
      <div className="border-t border-border/60 px-3 py-2.5">
        {source ? (
          <label className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Database className="size-3 shrink-0 text-primary" aria-hidden />
              Fonte dos filtros
            </span>
            <select
              value={source.id}
              onChange={(event) => setPreferredSourceId(event.target.value)}
              className="w-full cursor-pointer rounded-md border border-border/70 bg-background px-2 py-1 text-[11px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {readySources.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-[10px] leading-snug text-muted-foreground">
            Nenhum dataset.{" "}
            {canManageSources ? (
              <>
                <Link href="/fontes-de-dados/editor" className="text-primary underline-offset-2 hover:underline">
                  Criar um dataset
                </Link>{" "}
                para ver dados reais.
              </>
            ) : (
              "Peça a um analista para criar um."
            )}
          </p>
        )}
      </div>
      ) : null}
    </aside>
  );
};
