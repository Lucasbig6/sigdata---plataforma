"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Link2 } from "lucide-react";
import { useDashboardsStore } from "@/lib/dashboards/store";
import type { DashboardElement } from "@/lib/dashboards/types";
import { ELEMENT_LABELS } from "./element-renderers";

const nameOf = (element: DashboardElement): string => {
  const props = element.props as { title?: unknown; label?: unknown; content?: unknown };
  const text = [props.title, props.label, props.content].find((value) => typeof value === "string" && value.trim());
  const base = ELEMENT_LABELS[element.type];
  return typeof text === "string" ? `${base} · ${text.trim().slice(0, 28)}` : base;
};

/** Lista de camadas: do topo para o fundo, com visibilidade e ordem. */
export const LayersPanel = () => {
  const elements = useDashboardsStore((state) =>
    state.currentId ? (state.dashboards[state.currentId]?.elements ?? []) : [],
  );
  const selectedIds = useDashboardsStore((state) => state.selectedIds);
  const select = useDashboardsStore((state) => state.select);
  const toggleSelect = useDashboardsStore((state) => state.toggleSelect);
  const setHidden = useDashboardsStore((state) => state.setHidden);
  const moveLayer = useDashboardsStore((state) => state.moveLayer);

  if (elements.length === 0) {
    return <p className="text-[11px] text-muted-foreground">Nenhum elemento na página.</p>;
  }

  const ordered = [...elements].sort((a, b) => b.z - a.z);
  return (
    <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
      {ordered.map((element, index) => {
        const active = selectedIds.includes(element.id);
        return (
          <li
            key={element.id}
            className={`flex items-center gap-1 rounded-md pr-0.5 ${active ? "bg-primary/10" : "hover:bg-muted/50"}`}
          >
            <button
              type="button"
              onClick={(event) => (event.shiftKey || event.ctrlKey || event.metaKey ? toggleSelect(element.id) : select(element.id))}
              className={`flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1 text-left text-[11px] ${
                element.hidden ? "text-muted-foreground line-through" : active ? "text-primary" : "text-foreground"
              }`}
            >
              {element.groupId ? <Link2 className="size-3 shrink-0 text-muted-foreground" aria-label="Em grupo" /> : null}
              <span className="truncate">{nameOf(element)}</span>
            </button>
            <button
              type="button"
              aria-label={element.hidden ? "Mostrar" : "Ocultar"}
              title={element.hidden ? "Mostrar" : "Ocultar"}
              onClick={() => setHidden(element.id, !element.hidden)}
              className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {element.hidden ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
            </button>
            <button
              type="button"
              aria-label="Subir camada"
              title="Subir camada"
              disabled={index === 0}
              onClick={() => moveLayer(element.id, "up")}
              className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            >
              <ArrowUp className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Descer camada"
              title="Descer camada"
              disabled={index === ordered.length - 1}
              onClick={() => moveLayer(element.id, "down")}
              className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            >
              <ArrowDown className="size-3.5" aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
};
