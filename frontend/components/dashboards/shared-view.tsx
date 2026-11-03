"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardCanvas } from "@/components/dashboards/canvas";
import { ClearFilters } from "@/components/dashboards/clear-filters";
import { RefreshControl } from "@/components/dashboards/refresh-control";
import { ExportMenu } from "@/components/dashboards/export-menu";
import { PageTabs } from "@/components/dashboards/page-tabs";
import { ViewControls } from "@/components/dashboards/view-controls";
import { LogoMark } from "@/components/sigdata/logo";
import { ThemeToggle } from "@/components/sigdata/theme-toggle";
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

export type SharedViewSource = {
  /** Identifica o que está sendo lido (token do link público ou id do dashboard). */
  token: string;
  /** Endereço que devolve `{ dashboard, analyses }`. */
  loadUrl: string;
  /** Prefixo das rotas de dados; sem ele, usa a rota pública pelo token. */
  basePath?: string;
};

/** Visualização somente leitura de um dashboard: por link público ou compartilhado com a pessoa logada. */
export const SharedView = ({
  source,
  embed = false,
  backHref,
}: {
  source: SharedViewSource;
  /** Sem cabeçalho, para incorporar em outra página. */
  embed?: boolean;
  /** Mostra um botão de voltar no cabeçalho (uso dentro do app). */
  backHref?: string;
}) => {
  const { token, loadUrl, basePath } = source;
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
  const mode = useMemo(() => ({ kind: "public" as const, token, basePath }), [token, basePath]);
  const rootRef = useRef<HTMLDivElement>(null);
  const changeMobile = (next: boolean) => {
    setMobile(next);
    setFitMode(next ? "width" : "page");
  };

  useEffect(() => {
    let cancelled = false;
    fetch(loadUrl)
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
  }, [loadUrl, loadPublic]);

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
        <p className="text-sm font-medium text-foreground">{backHref ? "Dashboard indisponível" : "Link indisponível"}</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          {state.message} {backHref ? "O acesso pode ter sido retirado pelo autor." : "O link pode ter sido revogado pelo autor."}
        </p>
        {backHref ? (
          <Link href={backHref} className="mt-2 text-xs font-medium text-primary hover:underline">
            Voltar
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <DashboardDataProvider mode={mode} elements={pageElements} interactive>
    <div ref={rootRef} className="flex h-dvh flex-col overflow-hidden bg-background">
      <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden bg-background">
        <DashboardCanvas zoom={zoom} preview fill mobile={mobile} />
        {embed ? (
          <>
            <ClearFilters className="absolute left-3 top-3 z-20" />
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-40">
              <PageTabs readOnly className="pointer-events-auto" />
            </div>
            <div className="absolute right-3 top-3 z-20">
              <RefreshControl />
            </div>
            <ViewControls
              className="absolute bottom-3 right-3"
              zoom={zoom}
              mode={fitMode}
              onMode={setFitMode}
              onZoom={setZoom}
              mobile={mobile}
              onMobile={changeMobile}
              fullscreenTarget={() => stage}
            />
          </>
        ) : null}
      </div>

      {embed ? null : (
        /* rodapé único: marca, páginas e ajuste de visualização; o painel ocupa todo o resto da tela */
        <footer className="relative z-20 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 bg-card/80 px-3 py-1.5 backdrop-blur md:h-11 md:flex-nowrap md:py-0">
          {backHref ? (
            <Link
              href={backHref}
              aria-label="Voltar"
              className="grid size-7 shrink-0 place-items-center rounded-md text-foreground transition-colors hover:bg-muted/60"
            >
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          ) : null}
          <div
            className="flex min-w-0 shrink items-center gap-2 md:max-w-[28%]"
            title={`${state.dashboard.name} · somente leitura · versão de ${new Date(state.dashboard.updatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`}
          >
            <LogoMark className="h-6 w-auto shrink-0" />
            <span className="shrink-0 text-xs font-semibold tracking-wide text-foreground">SIGDATA</span>
            <span className="hidden min-w-0 truncate text-xs text-muted-foreground lg:inline">· {state.dashboard.name}</span>
          </div>

          <div className="order-last flex w-full min-w-0 justify-center md:order-none md:w-auto md:flex-1">
            <PageTabs readOnly flat />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <ClearFilters />
            <RefreshControl />
            <ExportMenu mobileSize={mobileCanvas ?? undefined} menuAbove />
            <ThemeToggle />
            <span className="h-4 w-px bg-border/70" aria-hidden />
            <ViewControls
              flat
              zoom={zoom}
              mode={fitMode}
              onMode={setFitMode}
              onZoom={setZoom}
              mobile={mobile}
              onMobile={changeMobile}
              fullscreenTarget={() => rootRef.current}
            />
          </div>
        </footer>
      )}
    </div>
    </DashboardDataProvider>
  );
};
