"use client";

import { Copy, Pencil, Plus, Table2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { QueryDef } from "@/lib/domain/transform";
import { cn } from "@/lib/utils";

/** Painel "Consultas": cada consulta é uma tabela com as próprias etapas; uma pode combinar com outra. */
export const QueriesPanel = ({
  queries,
  activeId,
  onSelect,
  onAdd,
  onRename,
  onDuplicate,
  onRemove,
}: {
  queries: QueryDef[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}) => {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <aside className="flex min-h-0 w-full shrink-0 flex-col border-b border-border bg-card/40 lg:w-56 lg:border-r lg:border-b-0" aria-label="Consultas">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <h2 className="text-sm font-semibold">
          Consultas <span className="font-normal text-muted-foreground">[{queries.length}]</span>
        </h2>
        <Button size="icon-xs" variant="ghost" aria-label="Nova consulta" title="Nova consulta" onClick={onAdd}>
          <Plus aria-hidden />
        </Button>
      </div>
      <ul className="max-h-40 min-h-0 flex-1 overflow-y-auto p-1.5 text-sm lg:max-h-none">
        {queries.map((query) => {
          const active = query.id === activeId;
          return (
            <li key={query.id} className="group">
              <div className={cn("flex items-center gap-1 rounded-md pr-1 transition-colors hover:bg-muted/60", active && "bg-primary/10")}>
                {editing === query.id ? (
                  <input
                    autoFocus
                    defaultValue={query.name}
                    aria-label="Nome da consulta"
                    maxLength={120}
                    onBlur={(event) => {
                      onRename(query.id, event.target.value);
                      setEditing(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      if (event.key === "Escape") setEditing(null);
                    }}
                    className="m-1 h-7 min-w-0 flex-1 rounded border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelect(query.id)}
                    onDoubleClick={() => setEditing(query.id)}
                    aria-current={active}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <Table2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">{query.name}</span>
                  </button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Ações da consulta ${query.name}`}
                    className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground opacity-0 outline-none group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-muted"
                  >
                    ⋯
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => setEditing(query.id)}>
                      <Pencil aria-hidden /> Renomear
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDuplicate(query.id)}>
                      <Copy aria-hidden /> Duplicar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onRemove(query.id)}>
                      <Trash2 aria-hidden /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};
