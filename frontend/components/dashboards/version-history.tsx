"use client";

import { History, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import type { Dashboard } from "@/lib/dashboards/types";
import { inputCls } from "./panel-ui";

type Version = {
  id: string;
  label: string;
  name: string;
  createdAt: number;
  elements: number;
  pages: number;
};

const when = (at: number) =>
  new Date(at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Histórico de versões: salvar uma versão com nome e voltar a qualquer uma anterior. */
export const VersionHistory = ({ dashboardId, dirty }: { dashboardId: string; dirty: boolean }) => {
  const save = useDashboardsStore((state) => state.save);
  const saving = useDashboardsStore((state) => state.saving);
  const replaceFromServer = useDashboardsStore((state) => state.replaceFromServer);

  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Version[]>(`/api/dashboards/${dashboardId}/versions`)
      .then((list) => {
        setVersions(list);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }, [dashboardId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const saveNamed = () =>
    run("new", async () => {
      // grava o que está na tela antes, para a versão refletir o painel atual
      if (dirty) await save();
      await api(`/api/dashboards/${dashboardId}/versions`, { method: "POST", json: { label: label.trim() } });
      setLabel("");
      load();
    });

  const restore = (version: Version) => {
    const warning = dirty
      ? "Há alterações não salvas, que serão perdidas. Restaurar mesmo assim?"
      : `Restaurar a versão de ${when(version.createdAt)}? O estado atual fica guardado no histórico.`;
    if (!window.confirm(warning)) return;
    void run(version.id, async () => {
      const restored = await api<Dashboard>(`/api/dashboards/${dashboardId}/versions/${version.id}/restore`, {
        method: "POST",
      });
      replaceFromServer(restored);
      load();
      setOpen(false);
    });
  };

  const remove = (version: Version) =>
    run(version.id, async () => {
      await api(`/api/dashboards/${dashboardId}/versions/${version.id}`, { method: "DELETE" });
      load();
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Histórico de versões"
        className="flex h-9 items-center gap-1.5 rounded-md border border-border/70 bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted/60"
      >
        <History className="size-4" aria-hidden />
        <span className="hidden xl:inline">Histórico</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico de versões</DialogTitle>
            <DialogDescription>
              Cada salvamento guarda a versão anterior (no máximo uma a cada 10 minutos). Versões com nome ficam até
              você excluí-las.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            <input
              className={inputCls}
              value={label}
              maxLength={80}
              placeholder="Nome da versão (ex.: Antes da reunião)"
              onChange={(event) => setLabel(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && label.trim() && void saveNamed()}
            />
            <Button size="sm" disabled={!label.trim() || busy !== null || saving} onClick={() => void saveNamed()}>
              {busy === "new" ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Salvar versão
            </Button>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
            {versions === null && !error ? (
              <p className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden /> Carregando…
              </p>
            ) : versions?.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">
                Ainda não há versões. Elas aparecem depois do próximo salvamento.
              </p>
            ) : (
              <ul className="divide-y divide-border/70">
                {versions?.map((version) => (
                  <li key={version.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {version.label || "Versão automática"}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {when(version.createdAt)} · {version.elements} elemento(s)
                        {version.pages > 1 ? ` · ${version.pages} páginas` : ""}
                      </p>
                    </div>
                    <Button size="xs" variant="outline" disabled={busy !== null} onClick={() => restore(version)}>
                      {busy === version.id ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />}
                      Restaurar
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label="Excluir versão"
                      disabled={busy !== null}
                      onClick={() => void remove(version)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </>
  );
};
