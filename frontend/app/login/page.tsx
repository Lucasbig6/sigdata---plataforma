"use client";

import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Logo } from "@/components/sigdata/logo";
import { ThemeToggle } from "@/components/sigdata/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn, signUp } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type Mode = "entrar" | "cadastrar";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
  USER_ALREADY_EXISTS: "Já existe uma conta com este e-mail.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Já existe uma conta com este e-mail.",
  PASSWORD_TOO_SHORT: "A senha precisa ter pelo menos 8 caracteres.",
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
  const [mode, setMode] = useState<Mode>("entrar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result =
      mode === "entrar"
        ? await signIn.email({ email, password })
        : await signUp.email({ name: name.trim() || email.split("@")[0], email, password });
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

      <div
        role="tablist"
        aria-label="Acesso"
        className="mb-5 flex gap-1 rounded-lg border border-border bg-muted/40 p-1"
      >
        {(
          [
            { id: "entrar", label: "Entrar" },
            { id: "cadastrar", label: "Criar conta" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={mode === tab.id}
            onClick={() => {
              setMode(tab.id);
              setError(null);
            }}
            className={cn(
              "flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              mode === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {mode === "cadastrar" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-xs font-medium text-muted-foreground">
              Nome
            </label>
            <Input
              id="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
        ) : null}
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
            autoComplete={mode === "entrar" ? "current-password" : "new-password"}
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {mode === "cadastrar" ? (
            <p className="text-[11px] text-muted-foreground">Mínimo de 8 caracteres.</p>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={busy} className="mt-1">
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {mode === "entrar" ? "Entrar" : "Criar conta"}
        </Button>
      </form>
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
