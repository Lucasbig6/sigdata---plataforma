"use client";

import { Check, Copy, ExternalLink, Globe, Loader2, Lock, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api/client";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { toast } from "@/lib/feedback";

const EXPIRY_OPTIONS: { value: string; label: string; days: number | null }[] = [
  { value: "nunca", label: "Sem expiração", days: null },
  { value: "1", label: "24 horas", days: 1 },
  { value: "7", label: "7 dias", days: 7 },
  { value: "30", label: "30 dias", days: 30 },
];

const publicUrl = (token: string) => `${window.location.origin}/compartilhado/${token}`;

type AccessState = { sharedWithAll: boolean; people: { id: string; name: string; email: string }[] };

/** Compartilhamento com pessoas logadas (somente leitura): por e-mail ou com todos os usuários. */
const AccessSection = ({ dashboardId, open }: { dashboardId: string; open: boolean }) => {
  const [state, setState] = useState<AccessState | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    api<AccessState>(`/api/dashboards/${dashboardId}/access`)
      .then(setState)
      .catch((err: Error) => setError(err.message));
  }, [open, dashboardId]);

  const save = async (next: { sharedWithAll: boolean; emails: string[] }) => {
    setBusy(true);
    setError(null);
    try {
      setState(await api<AccessState>(`/api/dashboards/${dashboardId}/access`, { method: "PUT", json: next }));
      toast.success("Acesso atualizado.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!state) return error ? <p className="text-xs text-destructive">{error}</p> : null;
  const emails = state.people.map((person) => person.email);

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Pessoas com acesso</p>
          <p className="text-[11px] text-muted-foreground">Precisam entrar no SIGDATA. Só leitura.</p>
        </div>
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-foreground">
          <input
            type="checkbox"
            checked={state.sharedWithAll}
            disabled={busy}
            onChange={(e) => void save({ sharedWithAll: e.target.checked, emails })}
          />
          Todos os usuários
        </label>
      </div>
      {state.people.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {state.people.map((person) => (
            <li key={person.id} className="flex items-center gap-1 rounded-full border border-border bg-muted/40 py-0.5 pr-1 pl-2 text-[11px] text-foreground">
              {person.name}
              <button
                type="button"
                aria-label={`Remover acesso de ${person.name}`}
                disabled={busy}
                onClick={() => void save({ sharedWithAll: state.sharedWithAll, emails: emails.filter((email) => email !== person.email) })}
                className="grid size-4 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const email = draft.trim().toLowerCase();
          if (!email) return;
          setDraft("");
          void save({ sharedWithAll: state.sharedWithAll, emails: [...new Set([...emails, email])] });
        }}
      >
        <input
          type="email"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="e-mail da pessoa"
          aria-label="E-mail da pessoa para dar acesso"
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <Button type="submit" size="sm" variant="outline" disabled={busy || !draft.trim()}>
          Adicionar
        </Button>
      </form>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
};

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
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [expiry, setExpiry] = useState("nunca");

  // validade atual do link, buscada ao abrir
  useEffect(() => {
    if (!open || !token) return;
    api<{ expiresAt: number | null }>(`/api/dashboards/${dashboardId}/share`)
      .then((state) => setExpiresAt(state.expiresAt))
      .catch(() => undefined);
  }, [open, token, dashboardId]);

  const changeExpiry = (value: string) =>
    void run(async () => {
      const days = EXPIRY_OPTIONS.find((option) => option.value === value)?.days ?? null;
      const state = await api<{ expiresAt: number | null }>(`/api/dashboards/${dashboardId}/share`, {
        method: "PATCH",
        json: { expiresInDays: days },
      });
      setExpiry(value);
      setExpiresAt(state.expiresAt);
      toast.success(days ? "Validade do link atualizada." : "O link não expira mais.");
    });

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
      toast.success("Link copiado.");
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
        aria-label="Compartilhar painel"
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

          <AccessSection dashboardId={dashboardId} open={open} />

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
              onClick={() =>
                void run(async () => {
                  if (token) {
                    await unshare(dashboardId);
                    setExpiresAt(null);
                    setExpiry("nunca");
                    toast.info("Link desativado.");
                  } else {
                    await share(dashboardId, EXPIRY_OPTIONS.find((o) => o.value === expiry)?.days ?? null);
                    toast.success("Link público ativado.");
                  }
                })
              }
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

          <div className="flex items-center justify-between gap-3">
            <label htmlFor="share-expiry" className="text-[11px] text-muted-foreground">
              Validade do link
              {token && expiresAt ? ` — expira em ${new Date(expiresAt).toLocaleString("pt-BR")}` : ""}
            </label>
            <select
              id="share-expiry"
              value={expiry}
              disabled={busy}
              onChange={(event) => (token ? changeExpiry(event.target.value) : setExpiry(event.target.value))}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {EXPIRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

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
