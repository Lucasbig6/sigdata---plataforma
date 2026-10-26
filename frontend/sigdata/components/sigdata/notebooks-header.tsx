"use client";

import { Compass, LayoutGrid, Layers, List, Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

type NotebooksHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
};

const TABS = [
  { label: "Todos", active: true },
  { label: "Painéis compartilhados", active: false, icon: Compass },
  { label: "Fontes de dados", active: false, icon: Layers },
] as const;

export const NotebooksHeader = ({
  query,
  onQueryChange,
  view,
  onViewChange,
}: NotebooksHeaderProps) => (
  <header className="sticky top-0 z-20 border-b border-border/60 bg-card/70 backdrop-blur">
    <div className="mx-auto flex h-20 max-w-7xl items-center gap-2 px-4 sm:gap-4">
      <Link
        href="/"
        aria-label="SIGDATA — página inicial"
        className="flex shrink-0 items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <Logo className="h-11 w-auto" />
      </Link>

      <nav aria-label="Filtros" className="hidden items-center gap-1 md:flex">
        {TABS.map((tab) => {
          const Icon = "icon" in tab ? tab.icon : null;
          return (
            <button
              key={tab.label}
              type="button"
              disabled={!tab.active}
              aria-current={tab.active ? "page" : undefined}
              title={tab.active ? undefined : "Em breve"}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors outline-none",
                "focus-visible:ring-3 focus-visible:ring-ring/40",
                tab.active
                  ? "bg-muted font-medium text-foreground"
                  : "cursor-not-allowed text-muted-foreground/60",
              )}
            >
              {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative w-40 sm:w-56">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Pesquisar projetos"
            aria-label="Pesquisar projetos"
            className="h-8 rounded-full bg-muted/50 pr-3 pl-8 text-xs"
          />
        </div>

        <div
          role="group"
          aria-label="Modo de visualização"
          className="hidden items-center rounded-lg border border-border/70 p-0.5 sm:flex"
        >
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Visualização em grade"
            aria-pressed={view === "grid"}
            onClick={() => onViewChange("grid")}
            className={cn(view === "grid" && "bg-muted text-foreground")}
          >
            <LayoutGrid className="size-3.5" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Visualização em lista"
            aria-pressed={view === "list"}
            onClick={() => onViewChange("list")}
            className={cn(view === "list" && "bg-muted text-foreground")}
          >
            <List className="size-3.5" aria-hidden />
          </Button>
        </div>

        <ThemeToggle />
      </div>
    </div>
  </header>
);
