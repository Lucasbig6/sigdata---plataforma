"use client";

import { Ban, KeyRound, MoreHorizontal, Search, Trash2, UserCheck } from "lucide-react";
import { useState } from "react";
import { ROLE_LABELS, type Role } from "@shared/domain/roles";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useAdminStore, type AdminUser } from "@/lib/admin/store";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/sigdata/user-menu";
import { RoleSelect } from "./role-select";
import { PasswordDialog, RemoveUserDialog } from "./user-action-dialogs";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

const StatusBadge = ({ banned }: { banned: boolean }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
      banned ? "border-destructive/30 text-destructive" : "border-border text-muted-foreground",
    )}
  >
    <span className={cn("size-1.5 rounded-full", banned ? "bg-destructive" : "bg-emerald-500")} aria-hidden />
    {banned ? "Desativado" : "Ativo"}
  </span>
);

/** Contas do sistema: papel editável na linha; senha, status e remoção no menu. */
export const UsersTable = ({ users }: { users: AdminUser[] }) => {
  const currentUserId = useSession().data?.user.id;
  const setRole = useAdminStore((state) => state.setRole);
  const setActive = useAdminStore((state) => state.setActive);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwordFor, setPasswordFor] = useState<AdminUser | null>(null);
  const [removing, setRemoving] = useState<AdminUser | null>(null);

  const run = async (userId: string, action: () => Promise<void>) => {
    setBusyId(userId);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const term = query.trim().toLowerCase();
  const visible = term
    ? users.filter(
        (user) =>
          user.name.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term) ||
          ROLE_LABELS[user.role].toLowerCase().includes(term),
      )
    : users;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full max-w-xs">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nome, e-mail ou perfil"
          aria-label="Buscar usuários"
          className="h-9 pl-8 text-xs"
        />
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Usuário</th>
              <th className="px-4 py-2.5 font-medium">Perfil</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Criado em</th>
              <th className="w-12 px-2 py-2.5">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  {term ? "Nenhum usuário encontrado para essa busca." : "Nenhum usuário cadastrado."}
                </td>
              </tr>
            ) : (
              visible.map((user) => {
                const isSelf = user.id === currentUserId;
                const busy = busyId === user.id;
                return (
                  <tr
                    key={user.id}
                    className={cn("border-b border-border/60 last:border-0", user.banned && "opacity-70")}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <UserAvatar name={user.name} email={user.email} size="sm" />
                        <div className="min-w-0">
                          <span className="block truncate font-medium text-foreground">
                            {user.name}
                            {isSelf ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">(você)</span> : null}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <RoleSelect
                        aria-label={`Perfil de ${user.name}`}
                        value={user.role}
                        disabled={isSelf || busy}
                        onChange={(role: Role) => void run(user.id, () => setRole(user.id, role))}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge banned={user.banned} />
                    </td>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-muted-foreground">
                      {dateFormat.format(new Date(user.createdAt))}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-sm" aria-label={`Ações para ${user.name}`} disabled={busy} />
                          }
                        >
                          <MoreHorizontal className="size-4" aria-hidden />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setPasswordFor(user)}>
                            <KeyRound className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            Redefinir senha
                          </DropdownMenuItem>
                          {isSelf ? null : (
                            <>
                              <DropdownMenuItem
                                onClick={() => void run(user.id, () => setActive(user.id, user.banned))}
                              >
                                {user.banned ? (
                                  <UserCheck className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                ) : (
                                  <Ban className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                )}
                                {user.banned ? "Reativar" : "Desativar"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setRemoving(user)}
                                className="text-destructive focus:text-destructive data-highlighted:text-destructive"
                              >
                                <Trash2 className="size-3.5 shrink-0" aria-hidden />
                                Remover conta
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <PasswordDialog user={passwordFor} onClose={() => setPasswordFor(null)} />
      <RemoveUserDialog user={removing} onClose={() => setRemoving(null)} />
    </div>
  );
};
