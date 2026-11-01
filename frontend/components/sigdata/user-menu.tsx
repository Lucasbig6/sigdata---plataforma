"use client";

import { ChevronDown, Code2, Database, LayoutDashboard, LogOut, Settings, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut, useRole, useSession } from "@/lib/auth-client";
import { DATA_ROLES, ROLE_LABELS, type Role } from "@shared/roles";

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/** Menu da conta no cabeçalho: dados da pessoa, atalhos e sair. */
export const UserMenu = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const name = session?.user.name ?? "";
  const email = session?.user.email ?? "";

  const role = useRole();
  type Link = { label: string; href: string; icon: typeof Settings; roles?: readonly Role[] };
  const links = ([
    { label: "Configurações", href: "/configuracoes", icon: Settings },
    { label: "Dashboards", href: "/dashboards", icon: LayoutDashboard },
    { label: "Fontes de dados", href: "/fontes-de-dados", icon: Database, roles: DATA_ROLES },
    { label: "Editor SQL", href: "/fontes-de-dados/editor", icon: Code2, roles: DATA_ROLES },
    { label: "Gerenciar usuários", href: "/admin/usuarios", icon: Users, roles: ["admin"] },
  ] satisfies Link[]).filter((link: Link) => !link.roles || (role !== null && link.roles.includes(role)));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={name ? `Conta de ${name}` : "Conta"}
        className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-border/70 py-1 pr-2 pl-1 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 sm:pr-3"
      >
        <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {initialsOf(name) || "?"}
        </span>
        <span className="hidden max-w-32 truncate text-sm text-foreground sm:block">
          {name.trim().split(/\s+/)[0] ?? ""}
        </span>
        <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2.5 py-2">
          <p className="truncate text-sm font-medium text-foreground">{name || "Carregando…"}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
          {role ? (
            <span className="mt-1.5 inline-block rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {ROLE_LABELS[role]}
            </span>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        {links.map(({ label, href, icon: Icon }) => (
          <DropdownMenuItem key={href} onClick={() => router.push(href)}>
            <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            {label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut().then(() => window.location.assign("/login"))}>
          <LogOut className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
