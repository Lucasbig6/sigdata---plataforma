"use client";

import { LayoutGrid, List, Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRole } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { DATA_ROLES, type Role } from "@shared/roles";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

type NotebooksHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
};

const NAV: { label: string; href: string; active: boolean; roles?: readonly Role[] }[] = [
  { label: "Projetos", href: "/", active: true },
  { label: "Dashboards", href: "/dashboards", active: false },
  { label: "Fontes de dados", href: "/fontes-de-dados", active: false, roles: DATA_ROLES },
  { label: "Usuários", href: "/admin/usuarios", active: false, roles: ["admin"] },
];

export const NotebooksHeader = ({ query, onQueryChange, view, onViewChange }: NotebooksHeaderProps) => {
  const role = useRole();
  return (
  <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:px-8 lg:px-15 md:h-20 md:flex-nowrap md:py-0">
      <Link
        href="/"
        aria-label="SIGDATA — página inicial"
        className="flex shrink-0 items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <Logo className="h-14 w-auto" />
      </Link>

      <nav aria-label="Áreas" className="order-last -mx-1 flex w-full items-center gap-1 overflow-x-auto md:order-none md:mx-0 md:w-auto">
        {NAV.filter((item) => !item.roles || (role !== null && item.roles.includes(role))).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              item.active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex min-w-0 items-center gap-2">
        <div className="relative w-40 sm:w-56">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar projetos"
            aria-label="Buscar projetos"
            className="h-9 rounded-lg bg-muted/50 pr-3 pl-8 text-sm"
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
