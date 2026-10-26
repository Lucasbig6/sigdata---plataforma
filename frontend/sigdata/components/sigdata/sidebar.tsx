"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";
import { Database, FolderKanban, LayoutDashboard, UserRound } from "lucide-react";
import {
  ThreadListItems,
  ThreadListNew,
  ThreadListRoot,
  ThreadListSearch,
} from "@/components/assistant-ui/elements/thread-list.aui";
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
import { useAuiState } from "@assistant-ui/react";
import { cn } from "@/lib/utils";
import { useSigdata, type SigdataSection } from "@/lib/sigdata-store";
import { Logo } from "./logo";

type NavItem = {
  section: SigdataSection;
  label: string;
  icon: typeof Database;
};

const NAV_ITEMS: NavItem[] = [
  { section: "fontes", label: "Fontes de dados", icon: Database },
  { section: "projetos", label: "Projetos", icon: FolderKanban },
];

export const SigdataSidebar = (props: ComponentProps<typeof Sidebar>) => {
  const { section, setSection } = useSigdata();
  const [search, setSearch] = useState("");
  const hasThreads = useAuiState((s) => s.threads.threadIds.length > 0);

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
            <ThreadListRoot>
              <ThreadListNew className="h-9 justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 text-sm font-medium text-primary hover:bg-primary/15 hover:text-primary data-active:bg-primary/15" />
              <SidebarGroupLabel className="px-0 pt-3 pb-1">Conversas recentes</SidebarGroupLabel>
              {hasThreads && (
                <ThreadListSearch
                  value={search}
                  onValueChange={setSearch}
                  className="border-border bg-muted/40"
                />
              )}
              <ThreadListItems searchQuery={hasThreads ? search : ""} />
            </ThreadListRoot>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="gap-1 p-0">
          <SidebarGroupLabel className="px-0">Espaço de trabalho</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/dashboards" />}
                tooltip="Dashboards"
                className="h-9"
              >
                <LayoutDashboard className="size-4" aria-hidden />
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
                    className="h-9"
                  >
                    <Icon className="size-4" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border px-3 py-3">
        <button
          type="button"
          onClick={() => setSection("conversa")}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start",
            "transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 outline-none",
          )}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border">
            <UserRound className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-foreground">Você</span>
            <span className="block truncate text-[11px] text-muted-foreground">sessão local</span>
          </span>
        </button>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
};
