"use client";

import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Logo } from "@/components/sigdata/logo";
import { ThemeToggle } from "@/components/sigdata/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth-client";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
  BANNED_USER: "Esta conta foi desativada. Fale com o administrador.",
  INVALID_EMAIL: "E-mail inválido.",
  TOO_MANY_REQUESTS: "Muitas tentativas. Aguarde um minuto e tente de novo.",
};

/** Mensagens cruas (rede, limite de requisições) que não chegam com um código conhecido. */
const friendlyError = (error: { code?: string; message?: string; status?: number }) => {
  if (error.code && ERROR_MESSAGES[error.code]) return ERROR_MESSAGES[error.code];
  if (error.status === 429) return ERROR_MESSAGES.TOO_MANY_REQUESTS;
  if (error.status && error.status >= 500) return "Servidor indisponível no momento. Tente novamente em instantes.";
  if (!error.status || /failed to fetch|network|load failed/i.test(error.message ?? "")) {
    return "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";
  }
  return error.message || "Não foi possível entrar.";
};

/** Só aceita caminhos internos como destino após o login. */
const safeNext = (value: string | null) =>
  value && value.startsWith("/") && !value.startsWith("//") ? value : "/";

const LoginForm = () => {
  const next = safeNext(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signIn.email({ email, password });
    if (result.error) {
      setError(friendlyError(result.error));
      setBusy(false);
      return;
    }
    // recarrega para que todos os stores comecem já com a sessão nova
    window.location.assign(next);
  };

  return (
    <div className="w-full max-w-[500px] rounded-2xl border border-border/70 bg-card/80 p-8 shadow-sm">
      <div className="mb-5 flex justify-center gap-5">
        <Logo className="h-18 w-auto shrink-0 mx-auto block" />
      </div>


      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
            E-mail
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
            Senha
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={busy} className="mt-1">
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Entrar
        </Button>
      </form>
      <p className="mt-5 text-center text-xs text-muted-foreground">
        Não tem acesso? As contas são criadas pelo administrador do SIGDATA.
      </p>
    </div>
  );
};

export default function LoginPage() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
