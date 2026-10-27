"use client";

import { Check, Copy, ExternalLink, Globe, Loader2, Lock, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDashboardsStore } from "@/lib/dashboards/store";

const publicUrl = (token: string) => `${window.location.origin}/compartilhado/${token}`;

/** Compartilhamento por link público (somente leitura, versão salva, dados ao vivo). */
export const ShareDialog = ({ dashboardId, dirty }: { dashboardId: string; dirty: boolean }) => {
  const token = useDashboardsStore((state) => state.shareTokens[dashboardId] ?? null);
  const share = useDashboardsStore((state) => state.share);
  const unshare = useDashboardsStore((state) => state.unshare);
  const save = useDashboardsStore((state) => state.save);
  const saving = useDashboardsStore((state) => state.saving);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(publicUrl(token));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-1.5 rounded-md border border-border/70 bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted/60"
      >
        <Share2 className="size-4" aria-hidden />
        <span className="hidden sm:inline">Compartilhar</span>
        {token ? (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            público
          </span>
        ) : null}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Compartilhar painel</DialogTitle>
            <DialogDescription>
              Quem tiver o link vê o painel em modo leitura, sem precisar de conta.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 rounded-lg border border-border p-3">
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                token ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}
            >
              {token ? <Globe className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {token ? "Link público ativo" : "Somente você"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {token ? "Qualquer pessoa com o link pode ver." : "Ninguém mais tem acesso a este painel."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(token)}
              aria-label="Link público"
              disabled={busy}
              onClick={() => void run(() => (token ? unshare(dashboardId) : share(dashboardId)))}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                token ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 size-4 rounded-full bg-background shadow transition-transform ${
                  token ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {token ? (
            <div className="flex gap-2">
              <input
                readOnly
                value={publicUrl(token)}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Link público"
                className="h-8 min-w-0 flex-1 rounded-md border border-border bg-muted/40 px-2 font-mono text-[11px] text-foreground outline-none"
              />
              <Button size="sm" variant="outline" onClick={() => void copy()}>
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                aria-label="Abrir link em nova aba"
                onClick={() => window.open(publicUrl(token), "_blank", "noopener")}
              >
                <ExternalLink aria-hidden />
              </Button>
            </div>
          ) : null}

          {token ? (
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground">Incorporar em outra página (sem cabeçalho)</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={`<iframe src="${publicUrl(token)}?embed=1" width="100%" height="600" style="border:0" loading="lazy"></iframe>`}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Código para incorporar"
                  className="h-8 min-w-0 flex-1 rounded-md border border-border bg-muted/40 px-2 font-mono text-[11px] text-foreground outline-none"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(`<iframe src="${publicUrl(token)}?embed=1" width="100%" height="600" style="border:0" loading="lazy"></iframe>`)
                      .catch(() => undefined);
                  }}
                >
                  <Copy aria-hidden />
                  Copiar
                </Button>
              </div>
            </div>
          ) : null}

          {dirty ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                O link mostra a última versão salva. Há alterações não salvas.
              </p>
              <Button size="xs" disabled={saving} onClick={() => void save()}>
                {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Salvar agora
              </Button>
            </div>
          ) : null}

          <ul className="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-muted-foreground">
            <li>Os dados são consultados ao vivo nas suas fontes a cada visita.</li>
            <li>Visitantes podem usar os filtros do painel, mas não editam nada.</li>
            <li>Desligar o link invalida o endereço na hora; religar gera um link novo.</li>
          </ul>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </>
  );
};
