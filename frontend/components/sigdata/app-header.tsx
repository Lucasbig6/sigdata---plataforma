"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useRole } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { DATA_ROLES, type Role } from "@shared/roles";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

const NAV: { label: string; href: string; match: (path: string) => boolean; roles?: readonly Role[] }[] = [
  { label: "Projetos", href: "/", match: (path) => path === "/" },
  { label: "Dashboards", href: "/dashboards", match: (path) => path.startsWith("/dashboards") },
  { label: "Fontes de dados", href: "/fontes-de-dados", match: (path) => path.startsWith("/fontes-de-dados"), roles: DATA_ROLES },
  { label: "Usuários", href: "/admin/usuarios", match: (path) => path.startsWith("/admin"), roles: ["admin"] },
];

/** Cabeçalho padrão das áreas do SIGDATA (início, dashboards, fontes, usuários, configurações). */
export const AppHeader = ({ actions }: { actions?: ReactNode }) => {
  const role = useRole();
  const pathname = usePathname() ?? "/";

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-5 sm:px-8 lg:px-15 md:h-20 md:flex-nowrap md:py-0">
        <Link
          href="/"
          aria-label="SIGDATA — página inicial"
          className="flex shrink-0 items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <Logo className="h-16 w-auto" />
        </Link>

        <nav aria-label="Áreas" className="order-last -mx-1 flex w-full items-center gap-1 overflow-x-auto md:order-none md:mx-0 md:w-auto">
          {NAV.filter((item) => !item.roles || (role !== null && item.roles.includes(role))).map((item) => {
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
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
};
