"use client";

/**
 * Zoom da página no estilo "modo de exibição" do Power BI:
 * ajustar à página, ajustar à largura, tamanho real ou zoom livre.
 * Nos modos de ajuste o zoom acompanha o tamanho da área visível.
 */
import { useCallback, useEffect, useState } from "react";

export type FitMode = "page" | "width" | "actual" | "custom";

export const FIT_LABELS: Record<Exclude<FitMode, "custom">, string> = {
  page: "Ajustar à página",
  width: "Ajustar à largura",
  actual: "Tamanho real (100%)",
};

type Options = {
  canvas: { width: number; height: number };
  /** Espaço (px) reservado em volta da página dentro da área visível. */
  padding: number;
  minZoom?: number;
  maxZoom?: number;
  initialMode?: FitMode;
};

const round = (value: number) => Math.floor(value * 1000) / 1000;

export const useZoomFit = ({ canvas, padding, minZoom = 0.1, maxZoom = 4, initialMode = "page" }: Options) => {
  // ref por callback: a área só existe depois de a tela carregar os dados
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<FitMode>(initialMode);
  const [custom, setCustom] = useState(1);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!stage) return;
    const measure = () => setBox({ w: stage.clientWidth, h: stage.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [stage]);

  const availW = Math.max(1, box.w - padding);
  const availH = Math.max(1, box.h - padding);
  const fitted =
    mode === "page"
      ? Math.min(availW / canvas.width, availH / canvas.height)
      : mode === "width"
        ? availW / canvas.width
        : mode === "actual"
          ? 1
          : custom;
  const zoom = box.w === 0 ? 1 : Math.min(maxZoom, Math.max(minZoom, round(fitted)));

  const setZoom = useCallback(
    (next: number) => {
      setCustom(Math.min(maxZoom, Math.max(minZoom, Math.round(next * 100) / 100)));
      setMode("custom");
    },
    [maxZoom, minZoom],
  );

  return { stageRef: setStage, stage, zoom, mode, setMode, setZoom };
};
