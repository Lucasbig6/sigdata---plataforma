"use client";

import { LayoutGrid, List, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AppHeader } from "./app-header";

type NotebooksHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
};

export const NotebooksHeader = ({ query, onQueryChange, view, onViewChange }: NotebooksHeaderProps) => (
  <AppHeader
    actions={
      <>
        <div className="relative w-40 sm:w-56">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar projetos"
            aria-label="Buscar projetos"
            className="h-9 rounded-lg bg-muted/50 pr-3 pl-8 text-sm"
          />
        </div>

        <div
          role="group"
          aria-label="Modo de visualização"
          className="hidden items-center rounded-lg border border-border/70 p-0.5 sm:flex"
        >
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Visualização em grade"
            aria-pressed={view === "grid"}
            onClick={() => onViewChange("grid")}
            className={cn(view === "grid" && "bg-muted text-foreground")}
          >
            <LayoutGrid className="size-3.5" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Visualização em lista"
            aria-pressed={view === "list"}
            onClick={() => onViewChange("list")}
            className={cn(view === "list" && "bg-muted text-foreground")}
          >
            <List className="size-3.5" aria-hidden />
          </Button>
        </div>
      </>
    }
  />
);
