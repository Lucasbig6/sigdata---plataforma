"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ComponentProps } from "react";
import {
  Check,
  ChevronDown,
  Database,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  MessageSquarePlus,
  Search,
  UserRound,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { signOut, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useDatasetsStore } from "@/lib/datasets/store";
import { useNotebooksStore } from "@/lib/notebooks/store";
import { useSigdata, type SigdataSection } from "@/lib/sigdata-store";
import { Logo } from "./logo";

type NavItem = {
  section: SigdataSection;
  label: string;
  icon: typeof Database;
  iconClassName: string;
};

const NAV_ITEMS: NavItem[] = [
  {
    section: "projetos",
    label: "Projetos",
    icon: FolderKanban,
    iconClassName: "text-violet-500",
  },
];

export const SigdataSidebar = (props: ComponentProps<typeof Sidebar>) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeNotebookId = searchParams.get("notebook");
  const { section, setSection } = useSigdata();
  const [search, setSearch] = useState("");
  const notebooksHydrated = useNotebooksStore((state) => state.hydrated);
  const hydrateNotebooks = useNotebooksStore((state) => state.hydrate);
  const notebooks = useNotebooksStore((state) => state.notebooks);
  const createNotebook = useNotebooksStore((state) => state.createNotebook);
  const datasetsHydrated = useDatasetsStore((state) => state.hydrated);
  const hydrateDatasets = useDatasetsStore((state) => state.hydrate);
  const datasets = useDatasetsStore((state) => state.datasets);
  const setNotebookSource = useNotebooksStore((state) => state.setNotebookSource);
  const activeNotebook = notebooks.find((notebook) => notebook.id === activeNotebookId) ?? null;
  const selectedId = activeNotebook?.sourceId ?? null;
  const readyDatasets = datasets.filter((dataset) => dataset.status === "pronta");
  const { data: session } = useSession();

  useEffect(() => {
    hydrateDatasets();
    hydrateNotebooks();
  }, [hydrateDatasets, hydrateNotebooks]);

  const selectedDataset = datasets.find((dataset) => dataset.id === selectedId) ?? null;

  const normalized = search.trim().toLowerCase();
  const visibleNotebooks = notebooks.filter((notebook) =>
    normalized ? notebook.title.toLowerCase().includes(normalized) : true,
  );

  const handleNewConversation = () => {
    const id = createNotebook();
    router.push(`/workspace?notebook=${id}`);
  };

  return (
    <Sidebar {...props}>
      <SidebarHeader className="border-b border-border px-3 py-3">
        <a
          href="/"
          aria-label="Ir para a página inicial"
          className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <Logo className="h-10 w-auto" />
        </a>
      </SidebarHeader>

      <SidebarContent className="gap-5 px-3 py-3">
        <SidebarGroup className="gap-2 p-0">
          <SidebarGroupContent className="flex flex-col gap-2">
            <h1 className="text-sm font-regular text-foreground">Conjuntos de dados</h1>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-9 w-full items-center gap-2 rounded-lg border border-border/70 bg-background px-2.5 text-start text-sm text-foreground transition-colors outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50">
                <Database className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  {datasetsHydrated && selectedDataset
                    ? selectedDataset.name
                    : "Selecionar dataset"}
                </span>
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {!activeNotebook ? (
                  <DropdownMenuItem disabled>Abra um projeto para escolher a fonte</DropdownMenuItem>
                ) : !datasetsHydrated || readyDatasets.length === 0 ? (
                  <DropdownMenuItem disabled>
                    Nenhum dataset disponível
                  </DropdownMenuItem>
                ) : (
                  readyDatasets.map((dataset) => (
                    <DropdownMenuItem
                      key={dataset.id}
                      onClick={() =>
                        setNotebookSource(
                          activeNotebook.id,
                          dataset.id === selectedId ? null : dataset.id,
                        )
                      }
                      className="gap-2.5"
                    >
                      <Check
                        className={cn(
                          "size-3.5 shrink-0",
                          dataset.id === selectedId
                            ? "text-primary"
                            : "invisible",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">{dataset.name}</span>
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/fontes-de-dados")}>
                  <Database className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  Gerenciar datasets
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="gap-1 p-0">
          <SidebarGroupLabel className="px-0">Espaço de trabalho</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/dashboards" />}
                tooltip="Dashboards"
                className="h-9 gap-2.5"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-sky-500/15">
                  <LayoutDashboard className="size-3.5 text-sky-500" aria-hidden />
                </span>
                <span className="truncate">Dashboards</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <SidebarMenuItem key={item.section}>
                  <SidebarMenuButton
                    isActive={section === item.section}
                    onClick={() => setSection(item.section)}
                    tooltip={item.label}
                    className="h-9 gap-2.5"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-violet-500/15">
                      <Icon className={cn("size-3.5", item.iconClassName)} aria-hidden />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="gap-2 p-0">
          <SidebarGroupContent className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleNewConversation}
              className="flex h-9 items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/15 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <MessageSquarePlus className="size-4" aria-hidden />
              Nova conversa
            </button>
            <SidebarGroupLabel className="px-0 pt-3 pb-1">Projetos recentes</SidebarGroupLabel>
            {notebooksHydrated && visibleNotebooks.length > 0 ? (
              <>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar projetos"
                    aria-label="Buscar projetos"
                    className="h-8 w-full rounded-md border border-border bg-muted/40 ps-8 pe-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                </div>
                <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
                  {visibleNotebooks.map((notebook) => {
                    const isActive =
                      notebook.id === activeNotebookId && pathname?.startsWith("/workspace");
                    return (
                      <li key={notebook.id}>
                        <button
                          type="button"
                          onClick={() => router.push(`/workspace?notebook=${notebook.id}`)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm transition-colors outline-none",
                            "focus-visible:ring-2 focus-visible:ring-ring/50",
                            isActive
                              ? "bg-muted text-foreground"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                          )}
                          title={notebook.title}
                        >
                          <MessageSquarePlus className="size-3.5 shrink-0 opacity-50" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{notebook.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="px-0.5 text-xs leading-relaxed text-muted-foreground">
                {notebooksHydrated
                  ? "Nenhum projeto ainda. Inicie uma conversa para criar o primeiro."
                  : "Carregando projetos…"}
              </p>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start",
              "transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 outline-none",
            )}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border">
              <UserRound className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-foreground">
                {session?.user.name ?? "Você"}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {session?.user.email ?? "carregando sessão…"}
              </span>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuItem onClick={() => router.push("/fontes-de-dados")}>
              <Database className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              Fontes de dados
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                void signOut().then(() => {
                  window.location.assign("/login");
                })
              }
            >
              <LogOut className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
};
