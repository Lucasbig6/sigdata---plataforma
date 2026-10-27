"use client";

import { Expand, Maximize, Minimize, Monitor, MoveHorizontal, Minus, Plus, Scan, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { FIT_LABELS, type FitMode } from "@/lib/dashboards/use-zoom-fit";

type Props = {
  zoom: number;
  mode: FitMode;
  onMode: (mode: FitMode) => void;
  onZoom: (zoom: number) => void;
  /** Alterna o layout para celular (omitido = sem o botão). */
  mobile?: boolean;
  onMobile?: (mobile: boolean) => void;
  /** Elemento que entra em tela cheia (omitido = sem o botão). */
  fullscreenTarget?: () => HTMLElement | null;
  className?: string;
};

const btn =
  "grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground";
const active = "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary";

/** Controles de visualização da página: zoom, ajustar à página/largura, 100% e tela cheia. */
export const ViewControls = ({ zoom, mode, onMode, onZoom, mobile, onMobile, fullscreenTarget, className = "" }: Props) => {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    // alguns navegadores recusam (iframes, políticas): sem efeito, não quebra a página
    void fullscreenTarget?.()?.requestFullscreen().catch(() => undefined);
  };

  return (
    <div
      className={`flex items-center gap-1 rounded-md border border-border/70 bg-popover/90 p-1 shadow-sm backdrop-blur ${className}`}
    >
      <button
        type="button"
        aria-label="Diminuir zoom"
        onClick={() => onZoom(Math.round((zoom - 0.1) * 10) / 10)}
        className={btn}
      >
        <Minus className="size-3.5" aria-hidden />
      </button>
      <span className="min-w-11 rounded px-1 text-center text-[11px] tabular-nums text-foreground">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        aria-label="Aumentar zoom"
        onClick={() => onZoom(Math.round((zoom + 0.1) * 10) / 10)}
        className={btn}
      >
        <Plus className="size-3.5" aria-hidden />
      </button>
      <span className="mx-0.5 h-4 w-px bg-border/70" />
      <button
        type="button"
        aria-label={FIT_LABELS.page}
        aria-pressed={mode === "page"}
        title={FIT_LABELS.page}
        onClick={() => onMode("page")}
        className={`${btn} ${mode === "page" ? active : ""}`}
      >
        <Maximize className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={FIT_LABELS.width}
        aria-pressed={mode === "width"}
        title={FIT_LABELS.width}
        onClick={() => onMode("width")}
        className={`${btn} ${mode === "width" ? active : ""}`}
      >
        <MoveHorizontal className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={FIT_LABELS.actual}
        aria-pressed={mode === "actual"}
        title={FIT_LABELS.actual}
        onClick={() => onMode("actual")}
        className={`${btn} ${mode === "actual" ? active : ""}`}
      >
        <Scan className="size-3.5" aria-hidden />
      </button>
      {onMobile ? (
        <>
          <span className="mx-0.5 h-4 w-px bg-border/70" />
          <button
            type="button"
            aria-label={mobile ? "Ver layout de computador" : "Ver layout de celular"}
            aria-pressed={Boolean(mobile)}
            title={mobile ? "Layout de computador" : "Layout de celular"}
            onClick={() => onMobile(!mobile)}
            className={`${btn} ${mobile ? active : ""}`}
          >
            {mobile ? <Monitor className="size-3.5" aria-hidden /> : <Smartphone className="size-3.5" aria-hidden />}
          </button>
        </>
      ) : null}
      {fullscreenTarget ? (
        <>
          <span className="mx-0.5 h-4 w-px bg-border/70" />
          <button
            type="button"
            aria-label={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
            title={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
            onClick={toggleFullscreen}
            className={btn}
          >
            {fullscreen ? <Minimize className="size-3.5" aria-hidden /> : <Expand className="size-3.5" aria-hidden />}
          </button>
        </>
      ) : null}
    </div>
  );
};
