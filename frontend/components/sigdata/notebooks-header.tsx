"use client";

import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AppHeader } from "./app-header";

type NotebooksHeaderProps = {
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
};

export const NotebooksHeader = ({ view, onViewChange }: NotebooksHeaderProps) => (
  <AppHeader
    actions={
      <>
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
