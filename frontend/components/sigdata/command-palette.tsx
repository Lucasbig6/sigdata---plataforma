"use client";

import {
  Code2,
  Database,
  FolderKanban,
  LayoutDashboard,
  MessageSquarePlus,
  Moon,
  Search,
  Settings,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { useDatasetsStore } from "@/lib/datasets/store";
import { useNotebooksStore } from "@/lib/notebooks/store";
import { useRole } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { canManageData } from "@shared/roles";

/** Evento para abrir a paleta de fora (ex.: botão da barra lateral). */
export const OPEN_PALETTE_EVENT = "sigdata:open-palette";
export const openCommandPalette = () => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));

type Entry = {
  id: string;
  group: "Ações" | "Projetos" | "Fontes de dados" | "Dashboards";
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
};

const GROUPS: Entry["group"][] = ["Ações", "Projetos", "Fontes de dados", "Dashboards"];
const MAX_PER_GROUP = 6;

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Páginas sem sessão (login, link público) não carregam dados da conta. */
const PUBLIC_PREFIXES = ["/login", "/compartilhado", "/redefinir-senha"];

export const CommandPalette = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const role = useRole();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const notebooks = useNotebooksStore((state) => state.notebooks);
  const datasets = useDatasetsStore((state) => state.datasets);
  const dashboards = useDashboardsStore((state) => state.dashboards);
  const dashboardOrder = useDashboardsStore((state) => state.order);

  const disabled = PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  useEffect(() => {
    if (disabled) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, [disabled]);

  // os dados só são buscados na primeira vez que a paleta abre
  useEffect(() => {
    if (!open) return;
    useNotebooksStore.getState().hydrate();
    useDatasetsStore.getState().hydrate();
    useDashboardsStore.getState().hydrate();
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setActive(0);
  };

  const entries = useMemo<Entry[]>(() => {
    const go = (href: string) => () => router.push(href);
    const actions: Entry[] = [
      {
        id: "a:novo-projeto",
        group: "Ações",
        label: "Nova conversa",
        hint: "Criar projeto",
        icon: MessageSquarePlus,
        run: () => router.push(`/workspace?notebook=${useNotebooksStore.getState().createNotebook()}`),
      },
      { id: "a:projetos", group: "Ações", label: "Ir para a página inicial", icon: FolderKanban, run: go("/") },
      ...(canManageData(role ?? "usuario")
        ? [
            { id: "a:fontes", group: "Ações" as const, label: "Fontes de dados", icon: Database, run: go("/fontes-de-dados") },
            { id: "a:preparar", group: "Ações" as const, label: "Preparar dados", icon: Wand2, run: go("/fontes-de-dados/preparar") },
            { id: "a:editor", group: "Ações" as const, label: "Editor SQL", icon: Code2, run: go("/fontes-de-dados/editor") },
          ]
        : []),
      ...(role === "admin"
        ? [{ id: "a:usuarios", group: "Ações" as const, label: "Gerenciar usuários", icon: Users, run: go("/admin/usuarios") }]
        : []),
      { id: "a:dashboards", group: "Ações", label: "Dashboards", icon: LayoutDashboard, run: go("/dashboards") },
      { id: "a:config", group: "Ações", label: "Configurações da conta", icon: Settings, run: go("/configuracoes") },
      {
        id: "a:tema",
        group: "Ações",
        label: resolvedTheme === "dark" ? "Ativar modo claro" : "Ativar modo escuro",
        icon: Moon,
        run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
      },
    ];
    return [
      ...actions,
      ...notebooks.map<Entry>((notebook) => ({
        id: `p:${notebook.id}`,
        group: "Projetos",
        label: notebook.title,
        icon: FolderKanban,
        run: go(`/workspace?notebook=${notebook.id}`),
      })),
      ...datasets.map<Entry>((dataset) => ({
        id: `f:${dataset.id}`,
        group: "Fontes de dados",
        label: dataset.name,
        hint: dataset.definition ? "Dataset" : undefined,
        icon: Database,
        run: go(canManageData(role ?? "usuario") ? "/fontes-de-dados" : "/"),
      })),
      ...dashboardOrder.flatMap<Entry>((id) => {
        const dashboard = dashboards[id];
        return dashboard
          ? [
              {
                id: `d:${id}`,
                group: "Dashboards",
                label: dashboard.name,
                icon: LayoutDashboard,
                run: go(`/dashboards/${id}`),
              },
            ]
          : [];
      }),
    ];
  }, [router, role, resolvedTheme, setTheme, notebooks, datasets, dashboards, dashboardOrder]);

  const visible = useMemo(() => {
    const needle = normalize(query.trim());
    const counts = new Map<string, number>();
    return GROUPS.flatMap((group) =>
      entries.filter((entry) => {
        if (entry.group !== group) return false;
        if (needle && !normalize(entry.label).includes(needle)) return false;
        const count = (counts.get(group) ?? 0) + 1;
        counts.set(group, count);
        return count <= MAX_PER_GROUP;
      }),
    );
  }, [entries, query]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, visible]);

  const choose = (entry: Entry | undefined) => {
    if (!entry) return;
    close();
    entry.run();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (visible.length === 0 ? 0 : (index + step + visible.length) % visible.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(visible[active]);
    }
  };

  if (disabled) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogContent showCloseButton={false} className="top-[20%] translate-y-0 gap-0 p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Busca global</DialogTitle>
        <DialogDescription className="sr-only">
          Procure projetos, fontes de dados, dashboards e ações. Use as setas e Enter.
        </DialogDescription>
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded
            aria-controls="command-palette-list"
            aria-activedescendant={visible[active] ? `cmd-${visible[active].id}` : undefined}
            placeholder="Buscar projetos, fontes, dashboards…"
            aria-label="Buscar"
            className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            Esc
          </kbd>
        </div>
        <div id="command-palette-list" ref={listRef} role="listbox" className="max-h-80 overflow-y-auto p-1.5">
          {visible.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nada encontrado para “{query.trim()}”.
            </p>
          ) : (
            GROUPS.map((group) => {
              const items = visible.filter((entry) => entry.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} role="group" aria-label={group} className="pb-1">
                  <p className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-muted-foreground">{group}</p>
                  {items.map((entry) => {
                    const index = visible.indexOf(entry);
                    const Icon = entry.icon;
                    return (
                      <div
                        key={entry.id}
                        id={`cmd-${entry.id}`}
                        role="option"
                        aria-selected={index === active}
                        onMouseMove={() => setActive(index)}
                        onClick={() => choose(entry)}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground",
                          index === active && "bg-muted",
                        )}
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                        {entry.hint ? <span className="text-xs text-muted-foreground">{entry.hint}</span> : null}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
