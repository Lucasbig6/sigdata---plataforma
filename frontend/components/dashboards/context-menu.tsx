"use client";

import {
  BringToFront,
  ClipboardPaste,
  Copy,
  CopyPlus,
  EyeOff,
  Group,
  MousePointerSquareDashed,
  Scissors,
  SendToBack,
  Trash2,
  Ungroup,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useDashboardsStore } from "@/lib/dashboards/store";

export type MenuState = { x: number; y: number; onElement: boolean };

const Item = ({
  icon: Icon,
  label,
  shortcut,
  danger,
  disabled,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    role="menuitem"
    disabled={disabled}
    onClick={onSelect}
    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent ${
      danger ? "text-destructive" : "text-foreground"
    }`}
  >
    <Icon className="size-3.5 shrink-0" aria-hidden />
    <span className="flex-1">{label}</span>
    {shortcut ? <span className="text-[10px] text-muted-foreground">{shortcut}</span> : null}
  </button>
);

const Separator = (): ReactNode => <div className="my-1 h-px bg-border/70" />;

/** Menu do botão direito: ações sobre a seleção ou sobre a página. */
export const CanvasContextMenu = ({ menu, onClose }: { menu: MenuState; onClose: () => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  const store = useDashboardsStore.getState;
  const selectedIds = useDashboardsStore((state) => state.selectedIds);
  const grouped = useDashboardsStore((state) => {
    const doc = state.currentId ? state.dashboards[state.currentId] : undefined;
    return Boolean(doc?.elements.some((el) => state.selectedIds.includes(el.id) && el.groupId));
  });
  const count = selectedIds.length;

  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("blur", onClose);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  const run = (action: () => void) => () => {
    action();
    onClose();
  };

  // mantém o menu dentro da janela
  const left = Math.min(menu.x, window.innerWidth - 232);
  const top = Math.min(menu.y, window.innerHeight - (menu.onElement ? 330 : 90));

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Ações do elemento"
      className="fixed z-[100] w-56 rounded-lg border border-border/80 bg-popover p-1 shadow-lg"
      style={{ left, top }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {menu.onElement && count > 0 ? (
        <>
          <Item icon={Copy} label="Copiar" shortcut="Ctrl+C" onSelect={run(() => store().copySelected())} />
          <Item icon={Scissors} label="Recortar" shortcut="Ctrl+X" onSelect={run(() => store().cutSelected())} />
          <Item icon={ClipboardPaste} label="Colar" shortcut="Ctrl+V" onSelect={run(() => store().paste())} />
          <Item icon={CopyPlus} label="Duplicar" shortcut="Ctrl+D" onSelect={run(() => store().duplicateSelected())} />
          <Separator />
          <Item
            icon={BringToFront}
            label="Trazer para frente"
            onSelect={run(() => selectedIds.forEach((id) => store().moveLayer(id, "front")))}
          />
          <Item
            icon={SendToBack}
            label="Enviar para trás"
            onSelect={run(() => [...selectedIds].reverse().forEach((id) => store().moveLayer(id, "back")))}
          />
          <Separator />
          <Item
            icon={Group}
            label="Agrupar"
            shortcut="Ctrl+G"
            disabled={count < 2}
            onSelect={run(() => store().groupSelected())}
          />
          <Item
            icon={Ungroup}
            label="Desagrupar"
            shortcut="Ctrl+Shift+G"
            disabled={!grouped}
            onSelect={run(() => store().ungroupSelected())}
          />
          <Item icon={EyeOff} label="Ocultar na visualização" onSelect={run(() => store().setHiddenSelected(true))} />
          <Separator />
          <Item icon={Trash2} label="Excluir" shortcut="Del" danger onSelect={run(() => store().removeSelected())} />
        </>
      ) : (
        <>
          <Item icon={ClipboardPaste} label="Colar" shortcut="Ctrl+V" onSelect={run(() => store().paste())} />
          <Item
            icon={MousePointerSquareDashed}
            label="Selecionar tudo"
            shortcut="Ctrl+A"
            onSelect={run(() => store().selectAll())}
          />
        </>
      )}
    </div>
  );
};
