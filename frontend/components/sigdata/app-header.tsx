"use client";

import {
  Database,
  FolderKanban,
  LayoutDashboard,
  Search,
  Shield,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useRole } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { DATA_ROLES, type Role } from "@shared/roles";
import { Button } from "@/components/ui/button";
import { openCommandPalette } from "./command-palette";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

type NavItem = {
  label: string;
  /** Rótulo curto para a barra inferior do celular. */
  short: string;
  href: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
  roles?: readonly Role[];
};

const NAV: NavItem[] = [
  {
    label: "Projetos",
    short: "Projetos",
    href: "/",
    icon: FolderKanban,
    match: (path) => path === "/",
  },
  {
    label: "Dashboards",
    short: "Dashboards",
    href: "/dashboards",
    icon: LayoutDashboard,
    match: (path) => path.startsWith("/dashboards"),
  },
  {
    label: "Fontes de dados",
    short: "Fontes",
    href: "/fontes-de-dados",
    icon: Database,
    match: (path) => path.startsWith("/fontes-de-dados"),
    roles: DATA_ROLES,
  },
  {
    label: "Administração",
    short: "Admin",
    href: "/admin/usuarios",
    icon: Shield,
    match: (path) => path.startsWith("/admin"),
    roles: ["admin"],
  },
];

/** Navegação principal no celular: barra fixa embaixo, ao alcance do polegar (o menu do topo some). */
const MobileNav = ({ items, pathname }: { items: NavItem[]; pathname: string }) => (
  <nav
    aria-label="Áreas"
    data-mobile-nav
    className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
  >
    {items.map((item) => {
      const active = item.match(pathname);
      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] outline-none transition-colors focus-visible:bg-muted",
            active ? "font-medium text-primary" : "text-muted-foreground",
          )}
        >
          <item.icon className="size-5" aria-hidden />
          {item.short}
        </Link>
      );
    })}
  </nav>
);

/** Cabeçalho padrão das áreas do SIGDATA (início, dashboards, fontes, usuários, configurações). */
export const AppHeader = ({ actions }: { actions?: ReactNode }) => {
  const role = useRole();
  const pathname = usePathname() ?? "/";
  const items = NAV.filter((item) => !item.roles || (role !== null && item.roles.includes(role)));

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:px-8 lg:px-15 md:h-20 md:flex-nowrap md:py-0">
          <Link
            href="/"
            aria-label="SIGDATA — página inicial"
            className="flex shrink-0 items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <Logo className="h-11 w-auto md:h-14" />
          </Link>

          <nav aria-label="Áreas" className="hidden items-center gap-1 md:flex">
            {items.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            {actions}
            <Button
              variant="ghost"
              size="sm"
              onClick={openCommandPalette}
              aria-label="Buscar"
              className="gap-1.5 text-muted-foreground"
            >
              <Search className="size-4" aria-hidden />
              <span className="hidden lg:inline">Buscar</span>
              <kbd className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] lg:inline">
                Ctrl K
              </kbd>
            </Button>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
      {/* fora do <header>: o backdrop-blur dele prenderia o `fixed` ao cabeçalho */}
      <MobileNav items={items} pathname={pathname} />
    </>
  );
};
