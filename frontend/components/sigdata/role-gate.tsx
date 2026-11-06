"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useRole } from "@/lib/auth-client";
import type { Role } from "@shared/roles";

/** Esconde uma página de quem não tem o papel necessário (o backend também recusa). */
export const RoleGate = ({ roles, children }: { roles: readonly Role[]; children: ReactNode }) => {
  const role = useRole();
  if (role === null) return <div className="min-h-dvh bg-background" aria-busy="true" />;
  if (!roles.includes(role)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-muted/60 text-muted-foreground">
          <Lock className="size-5" aria-hidden />
        </span>
        <h1 className="text-base font-medium text-foreground">Você não tem acesso a esta área</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Peça a um administrador para ajustar o seu perfil, se precisar dela.
        </p>
        <Button render={<Link href="/" />} nativeButton={false} variant="outline">
          Voltar ao início
        </Button>
      </div>
    );
  }
  return <>{children}</>;
};
