"use client";

import { Copy, Link2, Link2Off, Loader2, Share2 } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDashboardsStore } from "@/lib/dashboards/store";

const publicUrl = (token: string) => `${window.location.origin}/compartilhado/${token}`;

/** Link público somente-leitura do dashboard (gerar, copiar, revogar). */
export const ShareMenu = ({ dashboardId, dirty }: { dashboardId: string; dirty: boolean }) => {
  const token = useDashboardsStore((state) => state.shareTokens[dashboardId] ?? null);
  const share = useDashboardsStore((state) => state.share);
  const unshare = useDashboardsStore((state) => state.unshare);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    try {
      setNote(await fn());
    } catch (error) {
      setNote((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      return "Link copiado.";
    } catch {
      return value;
    }
  };

  return (
    <DropdownMenu onOpenChange={(open) => !open && setNote(null)}>
      <DropdownMenuTrigger className="flex h-9 items-center gap-1.5 rounded-md border border-border/70 bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted/60">
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
        <span className="hidden sm:inline">Compartilhar</span>
        {token ? <span className="size-1.5 rounded-full bg-primary" aria-label="Link ativo" /> : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
          {token
            ? "Qualquer pessoa com o link vê a versão salva deste dashboard, sem poder editar."
            : "Gere um link público somente-leitura da versão salva."}
          {dirty ? <span className="mt-1 block text-amber-600">Salve antes para publicar as alterações.</span> : null}
        </div>
        <DropdownMenuSeparator />
        {token ? (
          <>
            <DropdownMenuItem closeOnClick={false} onClick={() => void run(() => copy(publicUrl(token)))}>
              <Copy className="size-3.5" aria-hidden />
              Copiar link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(publicUrl(token), "_blank", "noopener")}>
              <Link2 className="size-3.5" aria-hidden />
              Abrir link
            </DropdownMenuItem>
            <DropdownMenuItem
              closeOnClick={false}
              onClick={() =>
                void run(async () => {
                  await unshare(dashboardId);
                  return "Link revogado.";
                })
              }
            >
              <Link2Off className="size-3.5 text-destructive" aria-hidden />
              Revogar link
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem
            closeOnClick={false}
            onClick={() =>
              void run(async () => {
                const created = await share(dashboardId);
                return copy(publicUrl(created));
              })
            }
          >
            <Link2 className="size-3.5" aria-hidden />
            Gerar link público
          </DropdownMenuItem>
        )}
        {note ? <p className="break-all px-2 py-1.5 text-[11px] text-primary">{note}</p> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
