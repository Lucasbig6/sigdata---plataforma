"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthCard } from "@/components/sigdata/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const Field = ({ id, label, ...props }: { id: string; label: string } & React.ComponentProps<typeof Input>) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
      {label}
    </label>
    <Input id={id} {...props} />
  </div>
);

/** Passo 1: pede o e-mail. Passo 2 (link do e-mail, com ?token=): define a nova senha. */
const ResetForm = () => {
  const params = useSearchParams();
  const token = params.get("token");
  const linkInvalid = params.get("error") === "INVALID_TOKEN";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"enviado" | "redefinida" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: failure } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setBusy(false);
    // mesma resposta exista ou não a conta: não revela quem tem cadastro
    if (failure && failure.status !== 404) setError("Não foi possível enviar o e-mail. Tente novamente.");
    else setDone("enviado");
  };

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: failure } = await authClient.resetPassword({ newPassword: password, token: token ?? "" });
    setBusy(false);
    if (failure) setError("Link inválido ou expirado. Peça um novo.");
    else setDone("redefinida");
  };

  if (done) {
    return (
      <AuthCard title={done === "enviado" ? "Verifique seu e-mail" : "Senha redefinida"}>
        <p role="status" className="mb-4 text-center text-sm text-muted-foreground">
          {done === "enviado"
            ? "Se existir uma conta com este e-mail, enviamos um link para criar uma nova senha. Ele vale por 1 hora."
            : "Sua senha foi alterada. Entre com a nova senha."}
        </p>
        <Button render={<Link href="/login" />} nativeButton={false} className="w-full" size="lg">
          Ir para o login
        </Button>
      </AuthCard>
    );
  }

  if (token && !linkInvalid) {
    return (
      <AuthCard title="Criar nova senha">
        <form onSubmit={resetPassword} className="flex flex-col gap-3">
          <Field id="new" label="Nova senha" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          <Field id="confirm" label="Repita a senha" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Redefinir senha
          </Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Recuperar senha">
      <form onSubmit={requestReset} className="flex flex-col gap-3">
        {linkInvalid ? (
          <p role="alert" className="text-xs text-destructive">Este link é inválido ou expirou. Peça um novo.</p>
        ) : null}
        <Field id="email" label="E-mail da conta" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Enviar link
        </Button>
        <Link href="/login" className="text-center text-xs text-muted-foreground hover:text-foreground">
          Voltar ao login
        </Link>
      </form>
    </AuthCard>
  );
};

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
