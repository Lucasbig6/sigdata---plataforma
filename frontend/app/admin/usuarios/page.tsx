"use client";

import { ArrowLeft, Link2, Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CardSkeletons, ErrorState } from "@/components/sigdata/list-states";
import { RoleGate } from "@/components/sigdata/role-gate";
import { ThemeToggle } from "@/components/sigdata/theme-toggle";
import { api } from "@/lib/api/client";
import { useSession } from "@/lib/auth-client";
import { toast } from "@/lib/feedback";
import { ROLES, ROLE_LABELS, type Role } from "@shared/roles";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
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
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Pessoa</th>
              <th className="px-4 py-2.5 font-medium">Perfil</th>
              <th className="px-4 py-2.5 text-right font-medium">Projetos</th>
              <th className="px-4 py-2.5 text-right font-medium">Dashboards</th>
              <th className="px-4 py-2.5 text-right font-medium">Fontes</th>
              <th className="px-4 py-2.5 text-right font-medium">Acesso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3">
                  <span className="block font-medium text-foreground">
                    {user.name}
                    {user.id === session?.user.id ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">(você)</span> : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">{user.email}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={`Perfil de ${user.name}`}
                      value={user.role}
                      disabled={saving === user.id}
                      onChange={(event) => void changeRole(user, event.target.value as Role)}
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
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
                <td className="px-4 py-3 text-right tabular-nums">{user.projects}</td>
                <td className="px-4 py-3 text-right tabular-nums">{user.dashboards}</td>
                <td className="px-4 py-3 text-right tabular-nums">{user.sources}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="xs"
                    variant="outline"
                    title="Gera um link para a pessoa definir uma nova senha"
                    onClick={() => void requestLink(user)}
                  >
                    <Link2 aria-hidden />
                    Link de acesso
                  </Button>
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
        <header className="sticky top-0 z-20 border-b border-border/60 bg-card/70 backdrop-blur">
          <div className="flex h-16 items-center gap-4 px-4 sm:px-8 lg:px-15">
            <Link
              href="/"
              aria-label="Voltar ao início"
              className="grid size-9 shrink-0 place-items-center rounded-md border border-border/70 text-foreground transition-colors hover:bg-muted/60"
            >
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
            <h1 className="flex-1 text-base font-medium text-foreground">Usuários e perfis</h1>
            <ThemeToggle />
          </div>
        </header>
        <main className="px-4 py-6 sm:px-10 lg:px-30">
          <UsersTable />
        </main>
      </div>
    </RoleGate>
  );
}
