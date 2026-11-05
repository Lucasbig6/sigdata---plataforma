"use client";

import { Link2, Loader2, MoreHorizontal, Trash2, UserPlus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CardSkeletons, ErrorState } from "@/components/sigdata/list-states";
import { RoleGate } from "@/components/sigdata/role-gate";
import { AdminTabs } from "@/components/sigdata/admin-tabs";
import { AppHeader } from "@/components/sigdata/app-header";
import { PageHeading } from "@/components/sigdata/page-heading";
import { api } from "@/lib/api/client";
import { useSession } from "@/lib/auth-client";
import { confirmAction, toast } from "@/lib/feedback";
import { ROLES, ROLE_LABELS, type Role } from "@shared/roles";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  disabled: boolean;
  createdAt: string;
  projects: number;
  dashboards: number;
  sources: number;
};

const ROLE_HINTS: Record<Role, string> = {
  usuario: "Cria projetos e dashboards próprios e usa datasets publicados.",
  analista: "Importa fontes, usa o editor SQL e cria e publica datasets.",
  admin: "Gerencia usuários, papéis e todas as fontes e datasets.",
};

type CreatedUser = { id: string; name: string; accessLink: string | null };

const NewUserDialog = ({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (created: CreatedUser) => void;
}) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("usuario");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api<CreatedUser>("/api/admin/users", { method: "POST", json: { name, email, role } });
      setName("");
      setEmail("");
      setRole("usuario");
      onCreated(created);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>
              A pessoa define a própria senha por um link de primeiro acesso, válido por 24 horas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <label htmlFor="novo-nome" className="text-xs font-medium text-muted-foreground">Nome</label>
            <Input id="novo-nome" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoFocus />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="novo-email" className="text-xs font-medium text-muted-foreground">E-mail</label>
            <Input id="novo-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="novo-perfil" className="text-xs font-medium text-muted-foreground">Perfil</label>
            <select
              id="novo-perfil"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {ROLES.map((value) => (
                <option key={value} value={value}>{ROLE_LABELS[value]}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">{ROLE_HINTS[role]}</p>
          </div>
          {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Criar usuário
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/** Mostra o link de acesso para o admin copiar e enviar à pessoa (a cópia é um clique explícito). */
const AccessLinkDialog = ({ link, onClose }: { link: { name: string; url: string } | null; onClose: () => void }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      toast.success("Link copiado.");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  };
  return (
    <Dialog open={link !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link de acesso de {link?.name}</DialogTitle>
          <DialogDescription>
            Envie este link à pessoa: ela define a própria senha e entra. Vale por 24 horas e só é mostrado agora.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <input
            readOnly
            value={link?.url ?? ""}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Link de acesso"
            className="h-8 min-w-0 flex-1 rounded-md border border-border bg-muted/40 px-2 font-mono text-[11px] text-foreground outline-none"
          />
          <Button size="sm" variant="outline" onClick={() => void copy()}>
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
};

const UsersTable = () => {
  const { data: session } = useSession();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<AdminUser[]>("/api/admin/users")
      .then(setUsers)
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  const changeRole = async (user: AdminUser, role: Role) => {
    setSaving(user.id);
    try {
      await api(`/api/admin/users/${user.id}`, { method: "PATCH", json: { role } });
      setUsers((list) => list?.map((entry) => (entry.id === user.id ? { ...entry, role } : entry)) ?? null);
      toast.success(`${user.name} agora é ${ROLE_LABELS[role].toLowerCase()}.`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(null);
    }
  };

  const [createOpen, setCreateOpen] = useState(false);
  const [shownLink, setShownLink] = useState<{ name: string; url: string } | null>(null);

  const toggleDisabled = async (user: AdminUser) => {
    const next = !user.disabled;
    const ok = await confirmAction({
      title: next ? `Desativar ${user.name}?` : `Reativar ${user.name}?`,
      description: next
        ? "A pessoa é desconectada e não consegue entrar. Projetos, dashboards e fontes dela ficam guardados."
        : "A pessoa volta a poder entrar com a mesma senha.",
      confirmLabel: next ? "Desativar" : "Reativar",
      destructive: next,
    });
    if (!ok) return;
    try {
      await api(`/api/admin/users/${user.id}`, { method: "PATCH", json: { disabled: next } });
      setUsers((list) => list?.map((entry) => (entry.id === user.id ? { ...entry, disabled: next } : entry)) ?? null);
      toast.success(next ? `${user.name} foi desativado.` : `${user.name} foi reativado.`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const removeUser = async (user: AdminUser) => {
    const ok = await confirmAction({
      title: `Remover ${user.name}?`,
      description: `Apaga a conta, ${user.projects} projeto(s), ${user.dashboards} dashboard(s) e as fontes dela. Datasets publicados ficam com você. Não dá para desfazer; para só bloquear o acesso, use Desativar.`,
      confirmLabel: "Remover",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api(`/api/admin/users/${user.id}`, { method: "DELETE" });
      setUsers((list) => list?.filter((entry) => entry.id !== user.id) ?? null);
      toast.success(`${user.name} foi removido.`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const requestLink = async (user: AdminUser) => {
    try {
      const { accessLink } = await api<{ accessLink: string | null }>(`/api/admin/users/${user.id}/access-link`, {
        method: "POST",
      });
      if (accessLink) setShownLink({ name: user.name, url: accessLink });
      else toast.info("Link enviado por e-mail.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (error) return <ErrorState title="Não foi possível carregar os usuários" message={error} onRetry={load} />;
  if (!users) return <CardSkeletons count={3} className="grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1" itemClassName="h-14 rounded-xl" />;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus aria-hidden />
          Novo usuário
        </Button>
      </div>
      <NewUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(created) => {
          setCreateOpen(false);
          load();
          if (created.accessLink) setShownLink({ name: created.name, url: created.accessLink });
          else toast.success(`Conta de ${created.name} criada. O link foi enviado por e-mail.`);
        }}
      />
      <AccessLinkDialog link={shownLink} onClose={() => setShownLink(null)} />

      <ul className="mb-6 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        {ROLES.map((role) => (
          <li key={role} className="rounded-lg border border-border/60 bg-card/60 p-3">
            <span className="block text-sm font-medium text-foreground">{ROLE_LABELS[role]}</span>
            {ROLE_HINTS[role]}
          </li>
        ))}
      </ul>

      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="w-full text-sm md:min-w-[44rem] max-md:block">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground max-md:hidden">
            <tr>
              <th className="px-4 py-2.5 font-medium">Pessoa</th>
              <th className="px-4 py-2.5 font-medium">Perfil</th>
              <th className="px-4 py-2.5 text-right font-medium">Projetos</th>
              <th className="px-4 py-2.5 text-right font-medium">Dashboards</th>
              <th className="px-4 py-2.5 text-right font-medium">Fontes</th>
              <th className="px-4 py-2.5 text-right font-medium">Acesso</th>
            </tr>
          </thead>
          {/* celular: cada pessoa vira um cartão (nome e ações em cima, perfil, depois os totais) */}
          <tbody className="divide-y divide-border/60 max-md:block">
            {users.map((user) => (
              <tr key={user.id} className="max-md:flex max-md:flex-wrap max-md:items-start max-md:gap-x-3 max-md:gap-y-2 max-md:p-3">
                <td className="px-4 py-3 max-md:order-1 max-md:min-w-0 max-md:flex-1 max-md:p-0">
                  <span className="block font-medium text-foreground">
                    {user.name}
                    {user.id === session?.user.id ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">(você)</span> : null}
                    {user.disabled ? (
                      <span className="ml-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-normal text-destructive">
                        Desativada
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">{user.email}</span>
                </td>
                <td className="px-4 py-3 max-md:order-3 max-md:w-full max-md:p-0">
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={`Perfil de ${user.name}`}
                      value={user.role}
                      disabled={saving === user.id}
                      onChange={(event) => void changeRole(user, event.target.value as Role)}
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 max-md:h-10 max-md:w-full max-md:text-sm"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                    {saving === user.id ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden /> : null}
                  </div>
                </td>
                <td data-label="Projetos" className="px-4 py-3 text-right tabular-nums max-md:order-4 max-md:p-0 max-md:text-xs max-md:text-muted-foreground max-md:before:mr-1 max-md:before:content-[attr(data-label)]">{user.projects}</td>
                <td data-label="Dashboards" className="px-4 py-3 text-right tabular-nums max-md:order-4 max-md:p-0 max-md:text-xs max-md:text-muted-foreground max-md:before:mr-1 max-md:before:content-[attr(data-label)]">{user.dashboards}</td>
                <td data-label="Fontes" className="px-4 py-3 text-right tabular-nums max-md:order-4 max-md:p-0 max-md:text-xs max-md:text-muted-foreground max-md:before:mr-1 max-md:before:content-[attr(data-label)]">{user.sources}</td>
                <td className="px-4 py-3 text-right max-md:order-2 max-md:p-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`Ações de ${user.name}`}
                      className="inline-grid size-8 place-items-center rounded-md border border-border/70 text-muted-foreground transition-colors outline-none hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <MoreHorizontal className="size-4" aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={() => void requestLink(user)}>
                        <Link2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        Link de acesso
                      </DropdownMenuItem>
                      {user.id !== session?.user.id ? (
                        <>
                          <DropdownMenuItem onClick={() => void toggleDisabled(user)}>
                            {user.disabled ? "Reativar conta" : "Desativar conta"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => void removeUser(user)}>
                            <Trash2 className="size-3.5 shrink-0" aria-hidden />
                            Remover conta
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Projetos e dashboards são privados: aqui só aparece quantos cada pessoa tem.
      </p>
    </>
  );
};

export default function UsersAdminPage() {
  return (
    <RoleGate roles={["admin"]}>
      <div className="min-h-dvh bg-background">
        <AppHeader />
        <main className="px-4 py-8 sm:px-10 sm:py-10 lg:px-30">
          <PageHeading
            title="Usuários e perfis"
            description="Crie contas, defina o que cada pessoa pode fazer e acompanhe as atividades."
          />
          <AdminTabs />
          <UsersTable />
        </main>
      </div>
    </RoleGate>
  );
}
