"use client";

import { FileCode2, Loader2, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Script } from "@/lib/sql-editor/scripts";
import { cn } from "@/lib/utils";

const Tab = ({
  script,
  active,
  running,
  onSelect,
  onClose,
  onRename,
}: {
  script: Script;
  active: boolean;
  running: boolean;
  onSelect: () => void;
  onClose: () => void;
  onRename: (name: string) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(script.name);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      input.current?.focus();
      input.current?.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== script.name) onRename(draft);
  };

  return (
    <div
      role="tab"
      aria-selected={active}
      className={cn(
        "group flex h-full max-w-48 shrink-0 items-center gap-1.5 border-r border-border ps-3 pe-1.5 text-xs transition-colors",
        active
          ? "border-t-2 border-t-primary bg-card text-foreground"
          : "border-t-2 border-t-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {running ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden />
      ) : (
        <FileCode2 className="size-3.5 shrink-0 text-primary/80" aria-hidden />
      )}
      {editing ? (
        <input
          ref={input}
          value={draft}
          maxLength={40}
          aria-label="Nome do script"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") setEditing(false);
          }}
          className="h-6 w-28 rounded border border-ring bg-background px-1 text-xs text-foreground outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={() => {
            setDraft(script.name);
            setEditing(true);
          }}
          title="Duplo clique para renomear"
          className="min-w-0 truncate py-2 outline-none focus-visible:underline"
        >
          {script.name}
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label={`Fechar ${script.name}`}
        className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground opacity-60 outline-none hover:bg-background hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover:opacity-100"
      >
        <X className="size-3" aria-hidden />
      </button>
    </div>
  );
};

/** Abas de scripts, como nos editores SQL: várias consultas abertas, renomeáveis e fecháveis. */
export const ScriptTabs = ({
  scripts,
  activeId,
  runningIds,
  onSelect,
  onClose,
  onRename,
  onNew,
}: {
  scripts: Script[];
  activeId: string | null;
  runningIds: Set<string>;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onNew: () => void;
}) => (
  <div role="tablist" aria-label="Scripts" className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-border bg-muted/50">
    {scripts.map((script) => (
      <Tab
        key={script.id}
        script={script}
        active={script.id === activeId}
        running={runningIds.has(script.id)}
        onSelect={() => onSelect(script.id)}
        onClose={() => onClose(script.id)}
        onRename={(name) => onRename(script.id, name)}
      />
    ))}
    <button
      type="button"
      onClick={onNew}
      aria-label="Novo script"
      title="Novo script"
      className="grid w-9 shrink-0 place-items-center text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <Plus className="size-4" aria-hidden />
    </button>
  </div>
);
