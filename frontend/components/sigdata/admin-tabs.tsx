"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Usuários e perfis", href: "/admin/usuarios" },
  { label: "Atividades", href: "/admin/atividades" },
];

/** Subabas da área de administração. */
export const AdminTabs = () => {
  const pathname = usePathname();
  return (
    <nav aria-label="Administração" className="-mt-4 mb-6 flex gap-1 border-b border-border/60">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
              active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
};
