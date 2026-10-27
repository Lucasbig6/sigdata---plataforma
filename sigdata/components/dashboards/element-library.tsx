"use client";

import { ELEMENT_LIBRARY, ELEMENT_MIME } from "@/lib/dashboards/presets";
import { useDashboardsStore } from "@/lib/dashboards/store";

export const ElementLibrary = () => {
  const addElement = useDashboardsStore((state) => state.addElement);

  return (
    <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-border/60 bg-card/40 lg:flex">
      <div className="sticky top-0 z-10 border-b border-border/60 bg-card/80 px-3 py-2.5 backdrop-blur">
        <p className="text-xs font-semibold text-foreground">Elementos</p>
        <p className="text-[10px] text-muted-foreground">Clique ou arraste para o canvas</p>
      </div>

      <div className="flex flex-col gap-4 p-3">
        {ELEMENT_LIBRARY.map((group) => (
          <section key={group.id}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(ELEMENT_MIME, item.key);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => addElement(item)}
                  className="group flex items-start gap-2.5 rounded-lg border border-transparent p-2 text-left transition-colors hover:border-border/70 hover:bg-muted/50 active:bg-muted"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border/60 bg-muted/60 text-primary transition-colors group-hover:border-primary/50">
                    <item.icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-foreground">
                      {item.label}
                    </span>
                    <span className="block text-[10px] leading-snug text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-auto border-t border-border/60 px-3 py-2.5">
        <p className="text-[10px] leading-snug text-muted-foreground">
          Todos os dados exibidos são de demonstração — nenhuma fonte real conectada.
        </p>
      </div>
    </aside>
  );
};
