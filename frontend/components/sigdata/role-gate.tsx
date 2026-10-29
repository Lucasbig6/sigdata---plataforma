"use client";

import { Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ROLE_LABELS, type Role } from "@shared/domain/roles";
import { useCan, useSession } from "@/lib/auth-client";

/**
 * Página restrita a um papel mínimo. É só a experiência: o backend recusa as
 * chamadas de quem não tem o papel de qualquer jeito.
 */
export const RoleGate = ({ role, children }: { role: Role; children: ReactNode }) => {
  const { isPending } = useSession();
  const allowed = useCan(role);

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-label="Carregando" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ShieldAlert className="size-5" aria-hidden />
          </span>
          <h1 className="text-base font-medium text-foreground">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">
            Esta área é do perfil {ROLE_LABELS[role]}. Peça acesso ao administrador do SIGDATA.
          </p>
          <Link href="/" className="text-sm font-medium text-primary hover:underline">
            Voltar aos projetos
          </Link>
        </div>
      </div>
    );
  }

  return children;
};
