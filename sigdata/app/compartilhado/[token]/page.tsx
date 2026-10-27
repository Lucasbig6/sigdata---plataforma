"use client";

import { Loader2, Minus, Plus } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardCanvas } from "@/components/dashboards/canvas";
import { LogoMark } from "@/components/sigdata/logo";
import { ThemeToggle } from "@/components/sigdata/theme-toggle";
import type { SavedAnalysis } from "@/lib/dashboards/analyses";
import { useDashboardsStore } from "@/lib/dashboards/store";
import type { Dashboard } from "@/lib/dashboards/types";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; dashboard: Dashboard };

/** Visualização pública (somente leitura) de um dashboard compartilhado por link. */
export default function SharedDashboardPage() {
  const { token } = useParams<{ token: string }>();
  const loadPublic = useDashboardsStore((s) => s.loadPublic);
  const [state, setState] = useState<State>({ status: "loading" });
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/dashboards/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = (await res.json()) as
          | { dashboard: Dashboard; analyses: SavedAnalysis[] }
          | { error: string };
        if (cancelled) return;
        if (!res.ok || "error" in data) {
          setState({
            status: "error",
            message: "error" in data ? data.error : "Link indisponível.",
          });
          return;
        }
        loadPublic(data.dashboard, data.analyses);
        setState({ status: "ready", dashboard: data.dashboard });
        // ajusta o zoom inicial à largura da janela
        const fit = (window.innerWidth - 48) / data.dashboard.canvas.width;
        setZoom(Math.max(0.3, Math.min(1, Math.round(fit * 10) / 10)));
      })
      .catch(() => !cancelled && setState({ status: "error", message: "Falha de rede." }));
    return () => {
      cancelled = true;
    };
  }, [token, loadPublic]);

  if (state.status === "loading") {
    return (
      <div className="flex h-dvh items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Carregando dashboard…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm font-medium text-foreground">Link indisponível</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          {state.message} O link pode ter sido revogado pelo autor.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border/60 bg-card/60 px-6 backdrop-blur">
        <LogoMark className="h-9 w-auto shrink-0" />
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-foreground">{state.dashboard.name}</h1>
          <p className="truncate text-[11px] text-muted-foreground">
            Somente leitura · atualizado em{" "}
            {new Date(state.dashboard.updatedAt).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-border/70 bg-background px-1 py-0.5">
            <button
              type="button"
              aria-label="Diminuir zoom"
              onClick={() => setZoom((z) => Math.max(0.3, Math.round((z - 0.1) * 10) / 10))}
              className="grid size-6 place-items-center rounded text-muted-foreground hover:text-foreground"
            >
              <Minus className="size-3.5" aria-hidden />
            </button>
            <span className="w-10 text-center text-[11px] tabular-nums">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              aria-label="Aumentar zoom"
              onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
              className="grid size-6 place-items-center rounded text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3.5" aria-hidden />
            </button>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <DashboardCanvas zoom={zoom} preview />
      </div>
    </div>
  );
}
