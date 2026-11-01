"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/sigdata/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient, signOut, useRole, useSession } from "@/lib/auth-client";
import { ROLE_LABELS } from "@shared/roles";
import { toast } from "@/lib/feedback";

const Section = ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
  <section className="rounded-xl border border-border/70 bg-card/60 p-5">
    <h2 className="text-sm font-medium text-foreground">{title}</h2>
    {description ? <p className="mt-0.5 mb-4 text-xs text-muted-foreground">{description}</p> : <div className="mb-4" />}
    {children}
  </section>
);

const Field = ({ id, label, ...props }: { id: string; label: string } & React.ComponentProps<typeof Input>) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
      {label}
    </label>
    <Input id={id} {...props} />
  </div>
);

const ProfileForm = () => {
  const { data: session } = useSession();
  const role = useRole();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) setName(session.user.name);
  }, [session]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const { error } = await authClient.updateUser({ name: name.trim() });
    setBusy(false);
    if (error) toast.error("Não foi possível salvar o nome.");
    else toast.success("Perfil atualizado.");
  };

  return (
    <form onSubmit={submit} className="flex max-w-sm flex-col gap-3">
      <Field id="nome" label="Nome" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
      <Field id="email" label="E-mail" value={session?.user.email ?? ""} readOnly disabled />
      <Field id="perfil" label="Perfil de acesso" value={role ? ROLE_LABELS[role] : ""} readOnly disabled />
      <Button type="submit" disabled={busy || !name.trim() || name.trim() === session?.user.name} className="self-start">
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Salvar
      </Button>
    </form>
  );
};

const PasswordForm = () => {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (next !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: failure } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setBusy(false);
    if (failure) {
      setError(failure.code === "INVALID_PASSWORD" ? "A senha atual está incorreta." : "Não foi possível alterar a senha.");
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    toast.success("Senha alterada. Os outros dispositivos foram desconectados.");
  };

  return (
    <form onSubmit={submit} className="flex max-w-sm flex-col gap-3">
      <Field id="atual" label="Senha atual" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
      <Field id="nova" label="Nova senha" type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
      <Field id="repita" label="Repita a nova senha" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      <Button type="submit" disabled={busy} className="self-start">
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Alterar senha
      </Button>
    </form>
  );
};

export default function SettingsPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-card/70 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-4 px-4">
          <Link
            href="/"
            aria-label="Voltar ao início"
            className="grid size-9 shrink-0 place-items-center rounded-md border border-border/70 text-foreground transition-colors hover:bg-muted/60"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
          <h1 className="flex-1 text-base font-medium text-foreground">Configurações</h1>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <Section title="Perfil" description="Como seu nome aparece no SIGDATA.">
          <ProfileForm />
        </Section>
        <Section title="Senha" description="Ao alterar, os outros dispositivos são desconectados.">
          <PasswordForm />
        </Section>
        <Section title="Sessão">
          <Button
            variant="outline"
            onClick={() => void signOut().then(() => window.location.assign("/login"))}
          >
            Sair da conta
          </Button>
        </Section>
      </main>
    </div>
  );
}
