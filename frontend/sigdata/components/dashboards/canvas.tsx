"use client";

import { useRef } from "react";
import { ELEMENT_MIME, findLibraryItem } from "@/lib/dashboards/presets";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { ELEMENT_SIZES } from "@/lib/dashboards/types";
import { CanvasElement } from "./canvas-element";

type Props = {
  zoom: number;
  preview: boolean;
};

export const DashboardCanvas = ({ zoom, preview }: Props) => {
  const doc = useDashboardsStore((state) =>
    state.currentId ? (state.dashboards[state.currentId] ?? null) : null,
  );
  const selectedId = useDashboardsStore((state) => state.selectedId);
  const select = useDashboardsStore((state) => state.select);
  const addElement = useDashboardsStore((state) => state.addElement);

  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  if (!doc) return null;

  const handleBackdropDown = (event: React.PointerEvent) => {
    const target = event.target as HTMLElement;
    if (
      target === canvasRef.current ||
      target === viewportRef.current ||
      target.classList.contains("sd-canvas-frame")
    ) {
      select(null);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const key = event.dataTransfer.getData(ELEMENT_MIME);
    if (!key) return;
    const item = findLibraryItem(key);
    if (!item || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const size = item.size ?? ELEMENT_SIZES[item.type];
    addElement(item, {
      x: (event.clientX - rect.left) / zoom - size.w / 2,
      y: (event.clientY - rect.top) / zoom - size.h / 2,
    });
  };

  const elements = [...doc.elements].sort((a, b) => a.z - b.z);

  return (
    <div
      ref={viewportRef}
      className="sd-canvas-viewport"
      onPointerDown={handleBackdropDown}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={handleDrop}
    >
      <div
        className="sd-canvas-frame"
        style={{
          width: doc.canvas.width * zoom + 72,
          height: doc.canvas.height * zoom + 72,
        }}
      >
        <div
          ref={canvasRef}
          className="sd-canvas"
          style={{
            width: doc.canvas.width,
            height: doc.canvas.height,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
          }}
        >
          {elements.map((element) => {
            if (preview && element.hidden) return null;
            return (
              <CanvasElement
                key={element.id}
                element={element}
                zoom={zoom}
                selected={!preview && element.id === selectedId}
                preview={preview}
              />
            );
          })}

          {doc.elements.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
              <p className="text-sm font-medium text-foreground/80">Canvas vazio</p>
              <p className="text-xs text-muted-foreground">
                Arraste elementos da biblioteca ou clique em um item para adicionar.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
