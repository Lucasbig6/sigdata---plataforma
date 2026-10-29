"use client";

import { Loader2 } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DashboardCanvas } from "@/components/dashboards/canvas";
import { ClearFilters } from "@/components/dashboards/clear-filters";
import { RefreshControl } from "@/components/dashboards/refresh-control";
import { ExportMenu } from "@/components/dashboards/export-menu";
import { PageTabs } from "@/components/dashboards/page-tabs";
import { ViewControls } from "@/components/dashboards/view-controls";
import { LogoMark } from "@/components/sigdata/logo";
import { ThemeToggle } from "@/components/sigdata/theme-toggle";
import { UserMenu } from "@/components/sigdata/user-menu";
import { useSession } from "@/lib/auth-client";
import type { SavedAnalysis } from "@/lib/dashboards/analyses";
import { DashboardDataProvider } from "@/lib/dashboards/live-data";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { CANVAS, type Dashboard } from "@/lib/dashboards/types";
import { toMobileLayout } from "@/lib/dashboards/mobile-layout";
import { globalFiltersFromOtherPages } from "@/lib/dashboards/pages";
import { useZoomFit } from "@/lib/dashboards/use-zoom-fit";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; dashboard: Dashboard };

/** Visualização pública (somente leitura) de um dashboard compartilhado por link. */
export default function SharedDashboardPage() {
  const { token } = useParams<{ token: string }>();
  // ?embed=1: sem cabeçalho, para incorporar em outra página
  const embed = useSearchParams().get("embed") === "1";
  // página pública: o menu do usuário só aparece se houver sessão
  const { data: session } = useSession();
  const loadPublic = useDashboardsStore((s) => s.loadPublic);
  const [state, setState] = useState<State>({ status: "loading" });
  const dashboard = state.status === "ready" ? state.dashboard : null;
  // a página aberta (o visitante troca pelas abas) vem do store
  const current = useDashboardsStore((s) => (s.currentId ? (s.dashboards[s.currentId] ?? null) : null));
  const activePageId = useDashboardsStore((s) => s.activePageId);
  const pageElements = useMemo(
    () => (current ? [...current.elements, ...globalFiltersFromOtherPages(current, activePageId)] : []),
    [current, activePageId],
  );
  // celular: começa no layout de celular em telas estreitas
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (window.innerWidth < 768) setMobile(true);
  }, []);
  const mobileCanvas = useMemo(() => (current && mobile ? toMobileLayout(current).canvas : null), [current, mobile]);
  const { stageRef, stage, zoom, mode: fitMode, setMode: setFitMode, setZoom } = useZoomFit({
    canvas: mobileCanvas ?? current?.canvas ?? dashboard?.canvas ?? CANVAS,
    padding: 0,
    maxZoom: 4,
    // páginas muito compridas (rolagem longa) leem melhor ocupando a largura toda
    initialMode: "page",
  });
  const mode = useMemo(() => ({ kind: "public" as const, token }), [token]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/dashboards/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => ({ error: "Servidor indisponível no momento." }))) as
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
      })
      .catch(() => !cancelled && setState({ status: "error", message: "Falha de rede." }));
    return () => {
      cancelled = true;
    };
  }, [token, loadPublic]);

  // páginas bem mais altas que largas (retrato/rolagem longa) começam ajustadas à largura
  useEffect(() => {
    if (dashboard && (mobile || dashboard.canvas.height > dashboard.canvas.width * 1.4)) setFitMode("width");
  }, [dashboard, mobile, setFitMode]);

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
    <DashboardDataProvider mode={mode} elements={pageElements} interactive>
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {embed ? null : (
      <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border/60 bg-card/60 px-6 backdrop-blur">
        <LogoMark className="h-9 w-auto shrink-0" />
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-foreground">{state.dashboard.name}</h1>
          <p className="truncate text-[11px] text-muted-foreground">
            Somente leitura · dados ao vivo · versão de{" "}
            {new Date(state.dashboard.updatedAt).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <RefreshControl />
          <ExportMenu mobileSize={mobileCanvas ?? undefined} />
          <ThemeToggle />
          {session ? <UserMenu /> : null}
        </div>
      </header>
      )}
      <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden bg-background">
        <DashboardCanvas zoom={zoom} preview fill mobile={mobile} />
        <ClearFilters className="absolute left-3 top-3 z-20" />
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-40">
          <PageTabs readOnly className="pointer-events-auto" />
        </div>
        {embed ? (
          <div className="absolute right-3 top-3 z-20">
            <RefreshControl />
          </div>
        ) : null}
        <ViewControls
          className="absolute bottom-3 right-3"
          zoom={zoom}
          mode={fitMode}
          onMode={setFitMode}
          onZoom={setZoom}
          mobile={mobile}
          onMobile={(next) => {
            setMobile(next);
            setFitMode(next ? "width" : "page");
          }}
          fullscreenTarget={() => stage}
        />
      </div>
    </div>
    </DashboardDataProvider>
  );
}
