"use client";

import { AlertTriangle, Database, Loader2 } from "lucide-react";
import type { LoadState } from "@/lib/dashboards/live-data";

/** Esqueleto enquanto o elemento carrega pela primeira vez. */
export const DataSkeleton = ({ label = "Carregando dados…" }: { label?: string }) => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[11px] text-muted-foreground">
    <Loader2 className="size-4 animate-spin" aria-hidden />
    {label}
  </div>
);

export const DataError = ({ message }: { message: string }) => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-4 text-center">
    <AlertTriangle className="size-4 text-destructive" aria-hidden />
    <p className="line-clamp-3 text-[11px] leading-snug text-destructive">{message}</p>
  </div>
);

/** Elemento de dados sem fonte ligada (só aparece no editor). */
export const NoBinding = () => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-4 text-center">
    <Database className="size-4 text-muted-foreground" aria-hidden />
    <p className="text-[11px] leading-snug text-muted-foreground">
      Selecione o elemento e escolha a fonte em <span className="font-medium">Dados</span>.
    </p>
  </div>
);

/** Indicador discreto de atualização sobre um dado já exibido. */
export const RefreshingDot = ({ state }: { state: LoadState<unknown> }) =>
  state.status === "loading" && state.data ? (
    <Loader2
      className="pointer-events-none absolute right-2 top-2 size-3 animate-spin text-muted-foreground"
      aria-label="Atualizando"
    />
  ) : null;
