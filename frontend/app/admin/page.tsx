"use client";

import { ArrowLeft, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { OverviewCards } from "@/components/admin/overview-cards";
import { UsersTable } from "@/components/admin/users-table";
import { LogoMark } from "@/components/sigdata/logo";
import { RoleGate } from "@/components/sigdata/role-gate";
import { ThemeToggle } from "@/components/sigdata/theme-toggle";
import { UserMenu } from "@/components/sigdata/user-menu";
import { Button } from "@/components/ui/button";
import { useAdminStore } from "@/lib/admin/store";

const AdminContent = () => {
  const { hydrated, error, users, overview, reload } = useAdminStore();
  const [creating, setCreating] = useState(false);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    void reload();
  }, [reload]);

  const refresh = () => {
    setReloading(true);
    void reload().finally(() => setReloading(false));
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-card/70 backdrop-blur">
        <div className="flex h-20 items-center gap-2 px-4 sm:gap-7 sm:px-15">
          <Link
            href="/"
            aria-label="Voltar ao início"
            className="grid size-10 shrink-0 place-items-center rounded-md border border-border/70 text-foreground transition-colors hover:bg-muted/60"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
          <LogoMark className="hidden h-11 w-auto shrink-0 sm:block" />
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-foreground">Administração</h1>
            <p className="truncate text-xs text-muted-foreground">Usuários, perfis de acesso e visão geral</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-8">
        <section aria-labelledby="visao-geral" className="flex flex-col gap-3">
          <h2 id="visao-geral" className="text-sm font-medium text-foreground">
            Visão geral
          </h2>
          <OverviewCards overview={overview} />
        </section>

        <section aria-labelledby="usuarios" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="usuarios" className="text-sm font-medium text-foreground">
              Usuários
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={refresh} disabled={reloading} aria-label="Atualizar lista">
                <RefreshCw className={reloading ? "animate-spin" : undefined} aria-hidden />
              </Button>
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                Novo usuário
              </Button>
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {hydrated ? (
            <UsersTable users={users} />
          ) : (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-lg bg-muted/50" />
              ))}
            </div>
          )}
        </section>
      </main>

      <CreateUserDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
};

/** Área do administrador: contas, perfis e números gerais do SIGDATA. */
export default function AdminPage() {
  return (
    <RoleGate role="admin">
      <AdminContent />
    </RoleGate>
  );
}
