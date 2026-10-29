"use client";

import { Loader2, MoreHorizontal, Play, Trash2, WandSparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { format as formatSql } from "sql-formatter";
import type { SqlCell as SqlCellData } from "@shared/domain/cells";
import { CodeEditor, type EditorHandle } from "@/components/fontes/sql/code-editor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCellsStore } from "@/lib/cells/store";
import { cn } from "@/lib/utils";
import { CellOutput } from "./cell-output";
import { CellGutter, CellShell } from "./cell-shell";
import { useActiveDataset } from "./use-active-dataset";

const normalize = (sql: string) => sql.replace(/;\s*$/, "").replace(/\s+/g, " ").trim();

const NOOP = () => undefined;

/** Célula SQL do notebook: editor, ▶ executar (Ctrl+Enter) e a saída logo abaixo. */
export const SqlCell = ({ projectId, cell }: { projectId: string; cell: SqlCellData }) => {
  const source = useActiveDataset(projectId);
  const edit = useCellsStore((state) => state.edit);
  const run = useCellsStore((state) => state.run);
  const remove = useCellsStore((state) => state.remove);
  const running = useCellsStore((state) => state.running[cell.id] ?? false);
  const error = useCellsStore((state) => state.errors[cell.id]);
  const focusId = useCellsStore((state) => state.focusId);
  const clearFocus = useCellsStore((state) => state.clearFocus);
  const handle = useRef<EditorHandle | null>(null);

  useEffect(() => {
    if (focusId !== cell.id) return;
    handle.current?.focus();
    clearFocus();
  }, [focusId, cell.id, clearFocus]);

  const execute = () => void run(projectId, cell.id);
  const stale = cell.result !== null && normalize(cell.result.sql) !== normalize(cell.sql);
  const formatDocument = () => {
    try {
      edit(projectId, cell.id, {
        sql: formatSql(cell.sql, { language: "postgresql", keywordCase: "upper", tabWidth: 2 }),
      });
    } catch {
      // SQL incompleto: o formatador desiste e o texto fica como está
    }
  };

  return (
    <CellShell
      kind="sql"
      gutter={
        <CellGutter
          label={running ? "[*]" : `[${cell.runNumber ?? " "}]`}
          action={
            <button
              type="button"
              onClick={execute}
              disabled={running || !source || !cell.sql.trim()}
              aria-label="Executar célula (Ctrl+Enter)"
              title={source ? "Executar (Ctrl+Enter)" : "Escolha um dataset em Fontes para executar"}
              className="grid size-7 place-items-center rounded-full border border-border bg-background text-foreground outline-none transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              {running ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Play className="size-3.5 translate-x-px fill-current" aria-hidden />}
            </button>
          }
        />
      }
    >
      <div className="flex items-center gap-2 border-b border-border/70 px-3 py-1.5">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-muted-foreground">
          SQL
        </span>
        <input
          value={cell.title}
          onChange={(event) => edit(projectId, cell.id, { title: event.target.value })}
          placeholder="Célula sem título"
          aria-label="Título da célula"
          maxLength={160}
          className="min-w-0 flex-1 bg-transparent text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground/60"
        />
        {stale && !running ? (
          <span className="shrink-0 text-[10px] text-muted-foreground" title="O resultado abaixo é da versão anterior">
            editada · execute de novo
          </span>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Ações da célula"
            className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <MoreHorizontal className="size-3.5" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={formatDocument}>
              <WandSparkles className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              Formatar SQL
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void remove(projectId, cell.id)}
              className="text-destructive data-highlighted:text-destructive"
            >
              <Trash2 className="size-3.5 shrink-0" aria-hidden />
              Excluir célula
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="text-[13px] [&_.cm-content]:min-h-14 [&_.cm-editor]:!h-auto [&_.cm-scroller]:max-h-72">
        <CodeEditor
          docKey={cell.id}
          value={cell.sql}
          source={source}
          onChange={(sql) => edit(projectId, cell.id, { sql })}
          onRun={execute}
          onFormat={formatDocument}
          onCursor={NOOP}
          handleRef={handle}
        />
      </div>

      {error || cell.result ? (
        <div className={cn("border-t border-border/70 px-3 py-2.5", running && "opacity-60")}>
          {error ? (
            <p role="alert" className="rounded-md bg-destructive/10 px-2.5 py-2 font-mono text-[11px] text-destructive">
              {error}
            </p>
          ) : null}
          {cell.result && !error ? <CellOutput result={cell.result} title={cell.title} /> : null}
        </div>
      ) : null}
    </CellShell>
  );
};
