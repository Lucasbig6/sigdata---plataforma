"use client";

import { GripVertical } from "lucide-react";
import { useEffect, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PANEL_WIDTH_MAX, PANEL_WIDTH_MIN, useSigdata, type SigdataSection } from "@/lib/sigdata-store";
import { SectionPlaceholder } from "./section-placeholder";
import { SourcesPanel } from "./sources-panel";
import { WorkPanel } from "./work-panel";
import { WorkspaceTopbar } from "./workspace-topbar";

const PANEL_BREAKPOINT = "(min-width: 1024px)";
const KEYBOARD_STEP = 24;

const SECTION_TITLES: Record<SigdataSection, string> = {
  conversa: "Conversa",
  projetos: "Projetos",
};

const useIsWide = () => {
  const [wide, setWide] = useState(true);

  useEffect(() => {
    const query = window.matchMedia(PANEL_BREAKPOINT);
    const onChange = () => setWide(query.matches);
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return wide;
};

/**
 * Alça entre um painel lateral e o chat. `side` diz de que lado o painel está:
 * arrastar para o centro estreita o painel, para fora alarga.
 */
const PanelDivider = ({
  side,
  label,
  width,
  onResize,
  onDone,
}: {
  side: "left" | "right";
  label: string;
  width: number;
  onResize: (px: number) => void;
  onDone: () => void;
}) => {
  // painel à esquerda cresce arrastando para a direita; painel à direita, para a esquerda
  const direction = side === "left" ? 1 : -1;

  const start = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.documentElement.dataset.resizing = "1";
    const onMove = (moveEvent: PointerEvent) => onResize(startWidth + direction * (moveEvent.clientX - startX));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      delete document.documentElement.dataset.resizing;
      onDone();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`${label} (setas esquerda e direita)`}
      aria-valuenow={width}
      aria-valuemin={PANEL_WIDTH_MIN}
      aria-valuemax={PANEL_WIDTH_MAX}
      tabIndex={0}
      onPointerDown={start}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") onResize(width - direction * KEYBOARD_STEP);
        else if (event.key === "ArrowRight") onResize(width + direction * KEYBOARD_STEP);
        else return;
        event.preventDefault();
        onDone();
      }}
      className={cn(
        "group relative hidden w-3 shrink-0 cursor-col-resize touch-none rounded-full transition-colors lg:block",
        "hover:bg-primary/20 active:bg-primary/40 outline-none focus-visible:bg-primary/30",
      )}
    >
      <GripVertical
        className="absolute top-1/2 left-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/40 group-hover:text-primary"
        aria-hidden
      />
    </div>
  );
};

/** Cartão flutuante dos painéis laterais (visual de notebook: cantos arredondados sobre fundo suave). */
const PanelCard = ({ className, style, children }: { className?: string; style?: React.CSSProperties; children: ReactNode }) => (
  <div
    style={style}
    className={cn("flex min-h-0 shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm", className)}
  >
    {children}
  </div>
);

export const AppShell = ({ children }: { children: ReactNode }) => {
  const {
    section,
    setSection,
    panelWidth,
    setPanelWidth,
    sidebarWidth,
    setSidebarWidth,
    savePreferences,
    panelCollapsed,
    sourcesCollapsed,
    panelMobileOpen,
    togglePanelCollapsed,
    toggleSourcesCollapsed,
    setPanelMobileOpen,
    hydrate,
  } = useSigdata();
  const wide = useIsWide();
  const [sourcesMobileOpen, setSourcesMobileOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!panelMobileOpen && !sourcesMobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPanelMobileOpen(false);
      setSourcesMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panelMobileOpen, sourcesMobileOpen, setPanelMobileOpen]);

  const showSources = wide && !sourcesCollapsed;
  const showStudio = wide && !panelCollapsed;

  const toggleSources = () => (wide ? (toggleSourcesCollapsed(), savePreferences()) : setSourcesMobileOpen(true));
  const toggleStudio = () => (wide ? (togglePanelCollapsed(), savePreferences()) : setPanelMobileOpen(true));

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <WorkspaceTopbar
        onToggleSources={toggleSources}
        onToggleStudio={toggleStudio}
        sourcesOpen={wide ? showSources : sourcesMobileOpen}
        studioOpen={wide ? showStudio : panelMobileOpen}
        fallbackTitle={SECTION_TITLES[section]}
      />

      <div className="flex min-h-0 flex-1 px-3 pb-3">
        {showSources ? (
          <>
            <PanelCard style={{ width: sidebarWidth }} className="max-w-[40%]">
              <SourcesPanel onCollapse={toggleSources} />
            </PanelCard>
            <PanelDivider
              side="left"
              label="Redimensionar fontes"
              width={sidebarWidth}
              onResize={setSidebarWidth}
              onDone={savePreferences}
            />
          </>
        ) : null}

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {section === "conversa" ? (
            children
          ) : (
            <SectionPlaceholder section={section} onBack={() => setSection("conversa")} />
          )}
        </main>

        {showStudio ? (
          <>
            <PanelDivider
              side="right"
              label="Redimensionar estúdio"
              width={panelWidth}
              onResize={setPanelWidth}
              onDone={savePreferences}
            />
            <PanelCard style={{ width: panelWidth }} className="max-w-[40%]">
              <WorkPanel className="border-s-0 bg-transparent" />
            </PanelCard>
          </>
        ) : null}
      </div>

      {sourcesMobileOpen && !wide ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Fontes">
          <div className="absolute inset-0 bg-black/55" onClick={() => setSourcesMobileOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-[min(100%,22rem)] bg-card shadow-2xl">
            <SourcesPanel onCollapse={() => setSourcesMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      {panelMobileOpen && !wide ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Estúdio">
          <div className="absolute inset-0 bg-black/55" onClick={() => setPanelMobileOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 right-0 w-[min(100%,32rem)] bg-card shadow-2xl">
            <WorkPanel />
          </div>
        </div>
      ) : null}
    </div>
  );
};
