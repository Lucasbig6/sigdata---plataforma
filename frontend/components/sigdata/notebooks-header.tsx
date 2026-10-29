"use client";

import { Compass, LayoutGrid, Layers, List, Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCan } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

type NotebooksHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
};

const TABS = [
  { label: "Todos", active: true },
  { label: "Painéis compartilhados", active: false, icon: Compass },
  { label: "Fontes de dados", active: false, icon: Layers, href: "/fontes-de-dados", analista: true },
] as const;

export const NotebooksHeader = ({
  query,
  onQueryChange,
  view,
  onViewChange,
}: NotebooksHeaderProps) => {
  const canManageSources = useCan("analista");
  const tabs = TABS.filter((tab) => !("analista" in tab) || canManageSources);

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-card/70 backdrop-blur">
      <div className="flex h-20 items-center gap-2 px-15 sm:gap-7">
        <Link
          href="/"
          aria-label="SIGDATA — página inicial"
          className="flex shrink-0 items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <Logo className="h-14 w-auto" />
        </Link>
        <hr className="hidden h-6 w-px border-l border-r-mauve-200 border-border/80 sm:block" />

        <nav aria-label="Filtros" className="hidden items-center gap-2 md:flex">
          {tabs.map((tab) => {
            const Icon = "icon" in tab ? tab.icon : null;
            const href = "href" in tab ? tab.href : undefined;
            const className = cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors outline-none",
              "focus-visible:ring-3 focus-visible:ring-ring/40",
              tab.active
                ? "bg-muted font-medium text-foreground"
                : href
                  ? "cursor-pointer text-foreground hover:bg-muted"
                  : "cursor-not-allowed text-muted-foreground/60",
            );
            const content = (
              <>
                {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
                {tab.label}
              </>
            );

            if (href) {
              return (
                <Link
                  key={tab.label}
                  href={href}
                  className={className}
                  title={`Gerenciar ${tab.label.toLowerCase()}`}
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={tab.label}
                type="button"
                disabled={!tab.active}
                aria-current={tab.active ? "page" : undefined}
                title={tab.active ? undefined : "Em breve"}
                className={className}
              >
                {content}
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
              className="h-10 rounded-2xl bg-muted/50 pr-4 pl-8 text-xs"
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
          <UserMenu />
        </div>
      </div>
    </header>
  );
};
