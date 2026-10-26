"use client";

import { useEffect, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { GripVertical, PanelRight, PanelRightOpen } from "lucide-react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSigdata, type SigdataSection } from "@/lib/sigdata-store";
import { SectionPlaceholder } from "./section-placeholder";
import { SigdataSidebar } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { WorkPanel } from "./work-panel";

const PANEL_BREAKPOINT = "(min-width: 1024px)";

const SECTION_TITLES: Record<SigdataSection, string> = {
  conversa: "Conversa",
  fontes: "Fontes de dados",
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

const PanelDivider = ({
  onPointerDown,
}: {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) => (
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label="Redimensionar painel"
    onPointerDown={onPointerDown}
    className={cn(
      "group relative z-10 hidden w-2 shrink-0 cursor-col-resize touch-none bg-transparent lg:block",
      "hover:bg-primary/30 active:bg-primary/50 transition-colors",
    )}
  >
    <GripVertical
      className="absolute top-1/2 left-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/50 group-hover:text-primary"
      aria-hidden
    />
  </div>
);

export const AppShell = ({ children }: { children: ReactNode }) => {
  const {
    section,
    setSection,
    panelWidth,
    setPanelWidth,
    panelCollapsed,
    panelMobileOpen,
    togglePanelCollapsed,
    setPanelMobileOpen,
    hydrate,
  } = useSigdata();
  const wide = useIsWide();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!panelMobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanelMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panelMobileOpen, setPanelMobileOpen]);

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panelWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (moveEvent: PointerEvent) => {
      setPanelWidth(startWidth + (startX - moveEvent.clientX));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  const showInlinePanel = wide && !panelCollapsed;
  const showPanelRail = wide && panelCollapsed;
  const showMobilePanel = !wide && panelMobileOpen;

  return (
    <SidebarProvider className="h-dvh overflow-hidden">
      <SigdataSidebar />
      <SidebarInset className="min-h-0 min-w-0">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
          <SidebarTrigger aria-label="Alternar barra lateral" />
          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            <h1 className="truncate text-sm font-medium text-foreground">
              {SECTION_TITLES[section]}
            </h1>
            <span className="hidden truncate text-xs text-muted-foreground sm:inline">
              SIGDATA — inteligência de dados
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            aria-pressed={wide ? !panelCollapsed : panelMobileOpen}
            onClick={() => (wide ? togglePanelCollapsed() : setPanelMobileOpen(true))}
          >
            <PanelRight className="size-4" aria-hidden />
            Painel
          </Button>
          <ThemeToggle />
        </header>

        <div className="relative flex min-h-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {section === "conversa" ? (
              children
            ) : (
              <SectionPlaceholder section={section} onBack={() => setSection("conversa")} />
            )}
          </div>

          {showInlinePanel && (
            <>
              <PanelDivider onPointerDown={startResize} />
              <div
                data-slot="sigdata-work-panel-wrapper"
                className="hidden max-w-[45%] shrink-0 lg:flex"
                style={{ width: panelWidth }}
              >
                <WorkPanel />
              </div>
            </>
          )}

          {showPanelRail && (
            <div className="hidden w-11 shrink-0 flex-col items-center gap-2 border-s border-border bg-panel pt-3 lg:flex">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={togglePanelCollapsed}
                aria-label="Expandir painel"
                title="Expandir painel"
              >
                <PanelRightOpen className="size-4" aria-hidden />
              </Button>
            </div>
          )}
        </div>
      </SidebarInset>

      {showMobilePanel && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-label="Área de trabalho">
          <div
            className="absolute inset-0 bg-black/55"
            onClick={() => setPanelMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 right-0 w-[min(100%,32rem)] shadow-2xl">
            <WorkPanel />
          </div>
        </div>
      )}
    </SidebarProvider>
  );
};
