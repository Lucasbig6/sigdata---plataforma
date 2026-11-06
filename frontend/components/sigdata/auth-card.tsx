import type { ReactNode } from "react";
import { Logo } from "@/components/sigdata/logo";
import { ThemeToggle } from "@/components/sigdata/theme-toggle";

/** Moldura das telas de acesso (login, recuperação de senha). */
export const AuthCard = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="relative flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4">
    <div className="absolute top-4 right-4">
      <ThemeToggle />
    </div>
    <div className="w-full max-w-[500px] rounded-2xl border border-border/70 bg-card/80 p-8 shadow-sm">
      <Logo className="mx-auto mb-5 block h-18 w-auto shrink-0" />
      <h1 className="mb-4 text-center text-base font-medium text-foreground">{title}</h1>
      {children}
    </div>
  </div>
);
