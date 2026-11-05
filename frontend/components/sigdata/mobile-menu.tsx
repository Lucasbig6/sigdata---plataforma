"use client";

import { Code2, LogOut, Menu, Search, Settings, Wand2, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { signOut, useRole, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { DATA_ROLES, ROLE_LABELS } from "@shared/roles";
import { openCommandPalette } from "./command-palette";
import { ThemeToggle } from "./theme-toggle";

export type MenuLink = { label: string; href: string; icon: LucideIcon; active: boolean };

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/**
 * Celular: o cabeçalho fica só com o logo e este botão; a gaveta reúne busca, ações da tela,
 * áreas do app, configurações, tema e conta.
 */
export const MobileMenu = ({
  links,
  pathname,
  actions,
}: {
  /** Áreas do app (as mesmas do menu do desktop). */
  links: MenuLink[];
  pathname: string;
  /** Ações da própria tela (ex.: busca de projetos), mostradas na gaveta. */
  actions?: ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const role = useRole();
  const name = session?.user.name ?? "";

  // trocou de tela: fecha a gaveta
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const extra: MenuLink[] = [
    {
      label: "Configurações",
      href: "/configuracoes",
      icon: Settings,
      active: pathname.startsWith("/configuracoes"),
    },
    ...(role !== null && DATA_ROLES.includes(role)
      ? [
          {
            label: "Preparar dados",
            href: "/fontes-de-dados/preparar",
            icon: Wand2,
            active: pathname.startsWith("/fontes-de-dados/preparar"),
          },
          {
            label: "Editor SQL",
            href: "/fontes-de-dados/editor",
            icon: Code2,
            active: pathname.startsWith("/fontes-de-dados/editor"),
          },
        ]
      : []),
  ];

  const row = (link: MenuLink) => (
    <li key={link.href}>
      <Link
        href={link.href}
        aria-current={link.active ? "page" : undefined}
        className={cn(
          "flex h-11 items-center gap-3 rounded-lg px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
          link.active
            ? "bg-muted font-medium text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )}
      >
        <link.icon className="size-4 shrink-0" aria-hidden />
        {link.label}
      </Link>
    </li>
  );

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        aria-expanded={open}
        className="ml-auto size-11 md:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </Button>

      {/* portal: o backdrop-blur do cabeçalho prenderia o `fixed` dentro dele */}
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-50 md:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
            >
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setOpen(false)}
                aria-hidden
              />
              <div className="absolute inset-y-0 right-0 flex w-[min(100%,20rem)] flex-col bg-card shadow-2xl">
                <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-2">
                  <span className="text-sm font-medium text-foreground">Menu</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setOpen(false)}
                    aria-label="Fechar menu"
                    className="size-10"
                  >
                    <X className="size-5" aria-hidden />
                  </Button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pb-4">
                  {actions ? <div className="flex flex-col gap-3 *:w-full!">{actions}</div> : null}

                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      openCommandPalette();
                    }}
                    className="flex h-11 items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <Search className="size-4 shrink-0" aria-hidden />
                    Buscar em tudo
                  </button>

                  <nav aria-label="Áreas do app">
                    <ul className="flex flex-col gap-0.5">{links.map(row)}</ul>
                  </nav>

                  <ul className="flex flex-col gap-0.5 border-t border-border/60 pt-3">
                    {extra.map(row)}
                  </ul>
                </div>

                <div className="flex shrink-0 items-center gap-3 border-t border-border/60 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {initialsOf(name) || "?"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {name || "Carregando…"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {role ? ROLE_LABELS[role] : session?.user.email}
                    </span>
                  </span>
                  <ThemeToggle className="size-10" />
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Sair"
                    title="Sair"
                    className="size-10"
                    onClick={() => void signOut().then(() => window.location.assign("/login"))}
                  >
                    <LogOut className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
};
