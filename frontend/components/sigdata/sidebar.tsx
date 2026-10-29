"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ComponentProps } from "react";
import {
  Code2,
  Database,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  MessageSquarePlus,
  Search,
  ShieldCheck,
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
import { signOut, useCan, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useDatasetsStore } from "@/lib/datasets/store";
import { UserAvatar } from "./user-menu";
import { SourcesList } from "@/components/workspace/sources-list";
import { useNotebooksStore } from "@/lib/notebooks/store";
import { useSigdata, type SigdataSection } from "@/lib/sigdata-store";
import { ChatListItem } from "./chat-list-item";
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
  const renameNotebook = useNotebooksStore((state) => state.renameNotebook);
  const deleteNotebook = useNotebooksStore((state) => state.deleteNotebook);
  const hydrateDatasets = useDatasetsStore((state) => state.hydrate);
  const { data: session } = useSession();
  const canManageSources = useCan("analista");
  const isAdmin = useCan("admin");

  useEffect(() => {
    hydrateDatasets();
    hydrateNotebooks();
  }, [hydrateDatasets, hydrateNotebooks]);

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
          <Logo className="h-14 block mx-auto w-auto " />
        </a>
      </SidebarHeader>

      <SidebarContent className="gap-5 px-3 py-3">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SourcesList />
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
                        <ChatListItem
                          title={notebook.title}
                          active={Boolean(isActive)}
                          onOpen={() => router.push(`/workspace?notebook=${notebook.id}`)}
                          onRename={(title) => renameNotebook(notebook.id, title)}
                          onDelete={() => {
                            deleteNotebook(notebook.id);
                            if (!isActive) return;
                            // excluiu a conversa aberta: abre outra, ou cria uma nova se não sobrou nenhuma
                            const next = notebooks.find((entry) => entry.id !== notebook.id);
                            router.push(`/workspace?notebook=${next ? next.id : createNotebook()}`);
                          }}
                        />
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
            <UserAvatar name={session?.user.name} email={session?.user.email} image={session?.user.image} size="sm" />
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
            {canManageSources ? (
              <>
                <DropdownMenuItem onClick={() => router.push("/fontes-de-dados")}>
                  <Database className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  Fontes de dados
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/fontes-de-dados/editor")}>
                  <Code2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  Editor SQL
                </DropdownMenuItem>
              </>
            ) : null}
            {isAdmin ? (
              <DropdownMenuItem onClick={() => router.push("/admin")}>
                <ShieldCheck className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                Administração
              </DropdownMenuItem>
            ) : null}
            {canManageSources ? <DropdownMenuSeparator /> : null}
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
