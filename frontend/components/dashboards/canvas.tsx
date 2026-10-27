"use client";

import { LayoutTemplate } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { draftFromColumn } from "@/lib/dashboards/auto-binding";
import { FIELD_MIME, applyFieldToElement, elementAt, type DraggedField } from "@/lib/dashboards/field-drop";
import { ELEMENT_MIME, findLibraryItem } from "@/lib/dashboards/presets";
import { toMobileLayout } from "@/lib/dashboards/mobile-layout";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { TEMPLATES, applyTemplate } from "@/lib/dashboards/templates";
import { ELEMENT_SIZES } from "@/lib/dashboards/types";
import { useDatasetsStore } from "@/lib/datasets/store";
import { CanvasContextMenu, type MenuState } from "./context-menu";
import { CanvasElement } from "./canvas-element";
import { useAddLibraryItem } from "./element-library";
import { VISUAL_MIME, useAddVisual } from "./workspace-library";

type Props = {
  zoom: number;
  preview: boolean;
  /** Página ocupa a tela toda (visualização/compartilhado): sem moldura, sombra ou bordas. */
  fill?: boolean;
  /** Mostra o layout para celular (gerado automaticamente; só leitura). */
  mobile?: boolean;
};

type Marquee = { x0: number; y0: number; x1: number; y1: number };

const MARQUEE_MIN = 4;

export const DashboardCanvas = ({ zoom, preview, fill = false, mobile = false }: Props) => {
  const doc = useDashboardsStore((state) =>
    state.currentId ? (state.dashboards[state.currentId] ?? null) : null,
  );
  const selectedIds = useDashboardsStore((state) => state.selectedIds);
  const guides = useDashboardsStore((state) => state.guides);
  const select = useDashboardsStore((state) => state.select);
  const selectMany = useDashboardsStore((state) => state.selectMany);
  const updateProps = useDashboardsStore((state) => state.updateProps);
  const addElement = useDashboardsStore((state) => state.addElement);
  const addItem = useAddLibraryItem();
  const addVisual = useAddVisual();
  const showGrid = useDashboardsStore((state) => state.showGrid);
  const snapToGrid = useDashboardsStore((state) => state.snapToGrid);

  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);

  // o retângulo de seleção acompanha o mouse pela janela toda
  const drag = useRef<{ x0: number; y0: number; additive: boolean; moved: boolean } | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const docRef = useRef(doc);
  docRef.current = doc;

  useEffect(() => {
    const toLogical = (event: PointerEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return { x: (event.clientX - rect.left) / zoomRef.current, y: (event.clientY - rect.top) / zoomRef.current };
    };
    const onMove = (event: PointerEvent) => {
      const start = drag.current;
      if (!start) return;
      const p = toLogical(event);
      if (!start.moved && Math.hypot(p.x - start.x0, p.y - start.y0) * zoomRef.current < MARQUEE_MIN) return;
      start.moved = true;
      setMarquee({ x0: start.x0, y0: start.y0, x1: p.x, y1: p.y });
    };
    const onUp = (event: PointerEvent) => {
      const start = drag.current;
      if (!start) return;
      drag.current = null;
      setMarquee(null);
      if (!start.moved) {
        if (!start.additive) select(null);
        return;
      }
      const p = toLogical(event);
      const left = Math.min(start.x0, p.x);
      const right = Math.max(start.x0, p.x);
      const top = Math.min(start.y0, p.y);
      const bottom = Math.max(start.y0, p.y);
      const hit = (docRef.current?.elements ?? [])
        .filter((el) => !el.hidden && el.x < right && el.x + el.w > left && el.y < bottom && el.y + el.h > top)
        .map((el) => el.id);
      const current = start.additive ? useDashboardsStore.getState().selectedIds : [];
      selectMany([...new Set([...current, ...hit])]);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [select, selectMany]);

  const view = useMemo(() => (doc && mobile ? toMobileLayout(doc) : doc), [doc, mobile]);

  if (!doc || !view) return null;

  const handleBackdropDown = (event: React.PointerEvent) => {
    if (preview || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target === canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      drag.current = {
        x0: (event.clientX - rect.left) / zoom,
        y0: (event.clientY - rect.top) / zoom,
        additive: event.shiftKey || event.ctrlKey || event.metaKey,
        moved: false,
      };
      return;
    }
    if (target === viewportRef.current || target.classList.contains("sd-canvas-frame")) select(null);
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    if (preview) return;
    event.preventDefault();
    const id = (event.target as HTMLElement).closest<HTMLElement>("[data-element-id]")?.dataset.elementId ?? null;
    if (id && !selectedIds.includes(id)) select(id);
    setMenu({ x: event.clientX, y: event.clientY, onElement: Boolean(id) });
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    if (!canvasRef.current || preview) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const grid = snapToGrid ? 8 : 1;
    const px = (event.clientX - rect.left) / zoom;
    const py = (event.clientY - rect.top) / zoom;

    const visualKey = event.dataTransfer.getData(VISUAL_MIME);
    if (visualKey) {
      addVisual(visualKey, { x: Math.round(px / grid) * grid, y: Math.round(py / grid) * grid });
      return;
    }

    const fieldRaw = event.dataTransfer.getData(FIELD_MIME);
    if (fieldRaw) {
      const field = JSON.parse(fieldRaw) as DraggedField;
      const sources = useDatasetsStore.getState().datasets;
      const target = elementAt(doc.elements, px, py);
      const patch = target ? applyFieldToElement(target, field, sources, event.altKey) : null;
      if (target && patch) {
        select(target.id);
        updateProps(target.id, patch, "binding");
        return;
      }
      // fora de qualquer elemento (ou elemento que não aceita): cria um novo a partir do campo
      const source = sources.find((entry) => entry.id === field.sourceId);
      const table = source?.tables.find((entry) => entry.name === field.table);
      const column = table?.columns.find((entry) => entry.name === field.column);
      if (!source || !table || !column) return;
      const draft = draftFromColumn(source, table, column);
      const item = findLibraryItem(draft.itemKey);
      if (item) {
        const size = item.size ?? ELEMENT_SIZES[item.type];
        addElement(
          item,
          { x: Math.round((px - size.w / 2) / grid) * grid, y: Math.round((py - size.h / 2) / grid) * grid },
          draft.props,
        );
      }
      return;
    }

    const key = event.dataTransfer.getData(ELEMENT_MIME);
    if (!key) return;
    const item = findLibraryItem(key);
    if (!item) return;
    const size = item.size ?? ELEMENT_SIZES[item.type];
    addItem(item, {
      x: Math.round((px - size.w / 2) / grid) * grid,
      y: Math.round((py - size.h / 2) / grid) * grid,
    });
  };

  const elements = [...view.elements].sort((a, b) => a.z - b.z);
  const multi = selectedIds.length > 1;

  return (
    <div
      ref={viewportRef}
      className={`sd-canvas-viewport${fill ? " sd-canvas-viewport--fill" : ""}`}
      style={fill && view.canvas.background ? { backgroundColor: view.canvas.background, backgroundImage: "none" } : undefined}
      onPointerDown={handleBackdropDown}
      onContextMenu={handleContextMenu}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={handleDrop}
    >
      <div
        className={`sd-canvas-frame${fill ? " sd-canvas-frame--fill" : ""}`}
        style={{
          width: view.canvas.width * zoom + (fill ? 0 : 72),
          height: view.canvas.height * zoom + (fill ? 0 : 72),
        }}
      >
        <div
          ref={canvasRef}
          className={`sd-canvas${showGrid && !preview ? "" : " sd-canvas--plain"}${fill ? " sd-canvas--fill" : ""}`}
          style={{
            ...(view.canvas.background && { backgroundColor: view.canvas.background }),
            width: view.canvas.width,
            height: view.canvas.height,
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
                selected={!preview && selectedIds.includes(element.id)}
                multi={multi}
                preview={preview}
                snap={snapToGrid}
              />
            );
          })}

          {/* guias de alinhamento durante o arrasto */}
          {!preview
            ? guides.x.map((x) => (
                <div
                  key={`gx-${x}`}
                  className="pointer-events-none absolute top-0 bottom-0 z-[60] bg-primary"
                  style={{ left: x, width: 1 / zoom }}
                />
              ))
            : null}
          {!preview
            ? guides.y.map((y) => (
                <div
                  key={`gy-${y}`}
                  className="pointer-events-none absolute left-0 right-0 z-[60] bg-primary"
                  style={{ top: y, height: 1 / zoom }}
                />
              ))
            : null}

          {marquee ? (
            <div
              className="pointer-events-none absolute z-[70] border border-primary bg-primary/10"
              style={{
                left: Math.min(marquee.x0, marquee.x1),
                top: Math.min(marquee.y0, marquee.y1),
                width: Math.abs(marquee.x1 - marquee.x0),
                height: Math.abs(marquee.y1 - marquee.y0),
                borderWidth: 1 / zoom,
              }}
            />
          ) : null}

          {view.elements.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
              <div className="pointer-events-none space-y-1">
                <p className="text-sm font-medium text-foreground/80">Página vazia</p>
                <p className="text-xs text-muted-foreground">
                  {preview
                    ? "Este painel ainda não tem elementos."
                    : "Arraste elementos da biblioteca ou comece por um modelo."}
                </p>
              </div>
              {!preview ? (
                <div className="flex flex-wrap items-stretch justify-center gap-2">
                  {TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => applyTemplate(template.id)}
                      className="flex w-44 flex-col items-start gap-1 rounded-lg border border-border/70 bg-card/70 p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/50"
                      style={{ transform: `scale(${1 / Math.max(zoom, 0.5)})`, transformOrigin: "center" }}
                    >
                      <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <LayoutTemplate className="size-3.5 text-primary" aria-hidden />
                        {template.label}
                      </span>
                      <span className="text-[10px] leading-snug text-muted-foreground">{template.description}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {menu ? <CanvasContextMenu menu={menu} onClose={() => setMenu(null)} /> : null}
    </div>
  );
};
