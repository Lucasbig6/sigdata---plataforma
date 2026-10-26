"use client";

import { memo } from "react";
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
  preview: boolean;
};

export const CanvasElement = memo(function CanvasElement({
  element,
  zoom,
  selected,
  preview,
}: Props) {
  const select = useDashboardsStore((state) => state.select);
  const moveElementTo = useDashboardsStore((state) => state.moveElementTo);
  const resizeElementTo = useDashboardsStore((state) => state.resizeElementTo);
  const beginTransaction = useDashboardsStore((state) => state.beginTransaction);
  const endTransaction = useDashboardsStore((state) => state.endTransaction);
  const updateProps = useDashboardsStore((state) => state.updateProps);

  const min = ELEMENT_MIN[element.type];

  return (
    <Rnd
      className={`sd-rnd${selected ? " is-selected" : ""}`}
      style={{ zIndex: element.z }}
      size={{ width: element.w, height: element.h }}
      position={{ x: element.x, y: element.y }}
      scale={zoom}
      disableDragging={preview}
      enableResizing={preview ? false : undefined}
      resizeHandleClasses={preview ? undefined : HANDLE_CLASSES}
      minWidth={min.w}
      minHeight={min.h}
      cancel=".no-drag"
      onDragStart={() => {
        select(element.id);
        beginTransaction(`drag:${element.id}`);
      }}
      onDrag={(_event, data) => {
        moveElementTo(element.id, data.x, data.y);
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
        onClick={() => {
          if (!preview) select(element.id);
        }}
        className="relative h-full w-full"
        style={{
          outline: selected && !preview ? "2px solid var(--selection-outline)" : undefined,
          outlineOffset: 1,
          opacity: element.hidden ? 0.3 : 1,
          pointerEvents: preview && element.type !== "filter" ? "none" : undefined,
          cursor: preview ? undefined : "move",
        }}
      >
        <ElementView
          element={element}
          onFilterChange={(value) => updateProps(element.id, { value }, "value")}
        />
        {selected && !preview ? (
          <span className="pointer-events-none absolute -top-1.5 left-1 z-10 -translate-y-full rounded-md border border-primary/40 bg-popover px-1.5 py-0.5 text-[10px] font-medium text-primary shadow-sm">
            {ELEMENT_LABELS[element.type]}
          </span>
        ) : null}
      </div>
    </Rnd>
  );
});
