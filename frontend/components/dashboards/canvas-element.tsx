"use client";

import { BringToFront, Copy, EyeOff, Maximize2, SendToBack, Trash2 } from "lucide-react";
import { memo, useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Rnd } from "react-rnd";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { ELEMENT_MIN, type DashboardElement } from "@/lib/dashboards/types";
import { ELEMENT_LABELS, ElementView } from "./element-renderers";

const HANDLE_CLASSES = {
  top: "sd-handle sd-handle-n",
  right: "sd-handle sd-handle-e",
  bottom: "sd-handle sd-handle-s",
  left: "sd-handle sd-handle-w",
  topLeft: "sd-handle sd-handle-nw",
  topRight: "sd-handle sd-handle-ne",
  bottomLeft: "sd-handle sd-handle-sw",
  bottomRight: "sd-handle sd-handle-se",
};

type Props = {
  element: DashboardElement;
  zoom: number;
  selected: boolean;
  /** Há mais de um elemento selecionado: sem alças nem barra de ações individual. */
  multi?: boolean;
  preview: boolean;
  snap?: boolean;
};

const GRID = 8;

const ToolButton = ({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
    className={`grid size-7 place-items-center rounded-md transition-colors hover:bg-muted ${
      danger ? "text-destructive hover:bg-destructive/10" : "text-foreground"
    }`}
  >
    {children}
  </button>
);

/** Ações rápidas sobre o elemento selecionado (tamanho constante em qualquer zoom). */
const ElementToolbar = ({ element, zoom }: { element: DashboardElement; zoom: number }) => {
  const duplicateElement = useDashboardsStore((state) => state.duplicateElement);
  const moveLayer = useDashboardsStore((state) => state.moveLayer);
  const setHidden = useDashboardsStore((state) => state.setHidden);
  const removeElement = useDashboardsStore((state) => state.removeElement);
  const select = useDashboardsStore((state) => state.select);
  return (
    <div
      className="no-drag absolute right-0 z-40 flex items-center gap-0.5 rounded-lg border border-border/80 bg-popover p-0.5 shadow-md"
      style={{ bottom: "100%", transform: `scale(${1 / zoom})`, transformOrigin: "bottom right", marginBottom: 6 / zoom }}
    >
      <ToolButton label="Duplicar (Ctrl+D)" onClick={() => duplicateElement(element.id)}>
        <Copy className="size-3.5" aria-hidden />
      </ToolButton>
      <ToolButton label="Trazer para frente" onClick={() => moveLayer(element.id, "front")}>
        <BringToFront className="size-3.5" aria-hidden />
      </ToolButton>
      <ToolButton label="Enviar para trás" onClick={() => moveLayer(element.id, "back")}>
        <SendToBack className="size-3.5" aria-hidden />
      </ToolButton>
      <ToolButton label="Ocultar na visualização" onClick={() => setHidden(element.id, !element.hidden)}>
        <EyeOff className="size-3.5" aria-hidden />
      </ToolButton>
      <span className="mx-0.5 h-4 w-px bg-border" />
      <ToolButton
        label="Excluir (Delete)"
        danger
        onClick={() => {
          removeElement(element.id);
          select(null);
        }}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </ToolButton>
    </div>
  );
};

export const CanvasElement = memo(function CanvasElement({
  element,
  zoom,
  selected,
  multi = false,
  preview,
  snap = false,
}: Props) {
  const select = useDashboardsStore((state) => state.select);
  const toggleSelect = useDashboardsStore((state) => state.toggleSelect);
  const selectForDrag = useDashboardsStore((state) => state.selectForDrag);
  const dragSelection = useDashboardsStore((state) => state.dragSelection);
  const dragged = useRef(false);
  const resizeElementTo = useDashboardsStore((state) => state.resizeElementTo);
  const beginTransaction = useDashboardsStore((state) => state.beginTransaction);
  const endTransaction = useDashboardsStore((state) => state.endTransaction);

  const min = ELEMENT_MIN[element.type];
  const [expanded, setExpanded] = useState(false);
  const expandable = preview && (element.type === "chart" || element.type === "table");
  const title = (element.props as { title?: string }).title || ELEMENT_LABELS[element.type];

  return (
    <Rnd
      className={`sd-rnd${selected ? " is-selected" : ""}`}
      style={{ zIndex: element.z }}
      size={{ width: element.w, height: element.h }}
      position={{ x: element.x, y: element.y }}
      scale={zoom}
      disableDragging={preview}
      enableResizing={preview || multi ? false : undefined}
      resizeHandleClasses={preview ? undefined : HANDLE_CLASSES}
      minWidth={min.w}
      minHeight={min.h}
      dragGrid={snap ? [GRID, GRID] : undefined}
      resizeGrid={snap ? [GRID, GRID] : undefined}
      cancel=".no-drag"
      onDragStart={() => {
        dragged.current = false;
        selectForDrag(element.id);
        beginTransaction(`drag:${element.id}`);
      }}
      onDrag={(_event, data) => {
        dragged.current = true;
        dragSelection(element.id, data.x, data.y, 6 / zoom);
      }}
      onDragStop={() => {
        endTransaction();
      }}
      onResizeStart={() => {
        select(element.id);
        beginTransaction(`resize:${element.id}`);
      }}
      onResize={(_event, _direction, ref, _delta, position) => {
        resizeElementTo(element.id, {
          w: ref.offsetWidth,
          h: ref.offsetHeight,
          x: position?.x,
          y: position?.y,
        });
      }}
      onResizeStop={() => {
        endTransaction();
      }}
    >
      <div
        data-element-id={element.id}
        onClick={(event) => {
          if (preview) return;
          // soltar um arrasto também dispara click: não deve mudar a seleção
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          if (event.shiftKey || event.ctrlKey || event.metaKey) toggleSelect(element.id);
          else select(element.id);
        }}
        className="relative h-full w-full"
        style={{
          outline: selected && !preview ? "2px solid var(--selection-outline)" : undefined,
          outlineOffset: 1,
          opacity: element.hidden ? 0.3 : 1,
          cursor: preview ? undefined : "move",
        }}
      >
        <ElementView element={element} />
        {expandable ? (
          <>
            <button
              type="button"
              aria-label={`Expandir ${title}`}
              title="Expandir"
              onClick={() => setExpanded(true)}
              className="absolute right-1.5 top-1.5 z-20 grid size-7 place-items-center rounded-md border border-border/70 bg-popover/90 text-muted-foreground opacity-0 shadow-sm backdrop-blur transition-opacity hover:text-foreground focus-visible:opacity-100 [div:hover>&]:opacity-100"
            >
              <Maximize2 className="size-3.5" aria-hidden />
            </button>
            <Dialog open={expanded} onOpenChange={setExpanded}>
              <DialogContent className="h-[85vh] w-[92vw] max-w-[92vw] grid-rows-[auto_1fr] sm:max-w-[92vw]">
                <DialogTitle className="pr-8 text-sm font-medium">{title}</DialogTitle>
                <div className="min-h-0">
                  <ElementView element={{ ...element, x: 0, y: 0 }} />
                </div>
              </DialogContent>
            </Dialog>
          </>
        ) : null}
        {selected && !multi && !preview ? (
          <>
            <span
              className="pointer-events-none absolute left-0 z-10 rounded-md border border-primary/40 bg-popover px-1.5 py-0.5 text-[10px] font-medium text-primary shadow-sm"
              style={{ bottom: "100%", transform: `scale(${1 / zoom})`, transformOrigin: "bottom left", marginBottom: 6 / zoom }}
            >
              {ELEMENT_LABELS[element.type]} · {element.w}×{element.h}
            </span>
            <ElementToolbar element={element} zoom={zoom} />
          </>
        ) : null}
      </div>
    </Rnd>
  );
});
