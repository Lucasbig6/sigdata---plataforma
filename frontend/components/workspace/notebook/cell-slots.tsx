"use client";

import { useAuiState } from "@assistant-ui/react";
import { Code2, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { SqlCell as SqlCellData } from "@shared/domain/cells";
import { useCellsStore } from "@/lib/cells/store";
import { cn } from "@/lib/utils";
import { SqlCell } from "./sql-cell";

const EMPTY: SqlCellData[] = [];

const useProjectCells = () => {
  const projectId = useSearchParams().get("notebook");
  const load = useCellsStore((state) => state.load);
  const cells = useCellsStore((state) => (projectId ? state.cellsByProject[projectId] : undefined)) ?? EMPTY;
  useEffect(() => {
    if (projectId) void load(projectId);
  }, [projectId, load]);
  return { projectId, cells };
};

const byPosition = (a: SqlCellData, b: SqlCellData) => a.position - b.position || a.createdAt.localeCompare(b.createdAt);

/** Botão "+ SQL" que cria uma célula num ponto do notebook. */
export const AddSqlCellButton = ({
  afterMessageId,
  variant = "chip",
}: {
  afterMessageId: string | null;
  variant?: "chip" | "composer";
}) => {
  const projectId = useSearchParams().get("notebook");
  const add = useCellsStore((state) => state.add);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = () => {
    if (!projectId || busy) return;
    setBusy(true);
    setError(null);
    add(projectId, { afterMessageId })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };

  return (
    <>
      <button
        type="button"
        onClick={create}
        disabled={!projectId || busy}
        title={error ?? "Nova célula SQL (executa no dataset ativo)"}
        className={cn(
          "flex items-center gap-1 rounded-full font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60",
          variant === "composer"
            ? "h-7 border border-border px-2.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
            : "h-6 border border-border bg-background px-2 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground",
          error && "border-destructive/50 text-destructive",
        )}
      >
        {variant === "composer" ? <Code2 className="size-3.5" aria-hidden /> : <Plus className="size-3" aria-hidden />}
        SQL
      </button>
    </>
  );
};

/** Células SQL que ficam depois de uma mensagem, + o divisor para inserir outra ali. */
export const CellsAfterMessage = ({ messageId }: { messageId: string | null }) => {
  const { projectId, cells } = useProjectCells();
  const here = useMemo(
    () => cells.filter((cell) => cell.afterMessageId === messageId).sort(byPosition),
    [cells, messageId],
  );
  const running = useAuiState((s) => s.thread.isRunning);
  if (!projectId) return null;

  return (
    <div className="flex flex-col gap-3">
      {here.map((cell) => (
        <SqlCell key={cell.id} projectId={projectId} cell={cell} />
      ))}
      {messageId !== null && !running ? (
        <div className="group/insert relative ms-[3.25rem] flex h-4 items-center">
          <span className="h-px flex-1 bg-transparent transition-colors group-hover/insert:bg-border" aria-hidden />
          <span className="absolute left-1/2 -translate-x-1/2 opacity-0 transition-opacity group-hover/insert:opacity-100 focus-within:opacity-100">
            <AddSqlCellButton afterMessageId={messageId} />
          </span>
        </div>
      ) : null}
    </div>
  );
};

/**
 * Células cuja mensagem de referência sumiu (resposta regenerada, edição da
 * pergunta): continuam no fim do notebook em vez de desaparecer.
 */
export const OrphanCells = () => {
  const { projectId, cells } = useProjectCells();
  const messageIds = useAuiState((s) => s.thread.messages.map((message) => message.id).join("|"));
  const orphans = useMemo(() => {
    const known = new Set(messageIds.split("|"));
    return cells.filter((cell) => cell.afterMessageId !== null && !known.has(cell.afterMessageId)).sort(byPosition);
  }, [cells, messageIds]);
  if (!projectId || orphans.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {orphans.map((cell) => (
        <SqlCell key={cell.id} projectId={projectId} cell={cell} />
      ))}
    </div>
  );
};

/** "+ SQL" do rodapé: a célula entra no fim do notebook. */
export const ComposerSqlButton = () => {
  const lastId = useAuiState((s) => s.thread.messages.at(-1)?.id ?? null);
  return <AddSqlCellButton afterMessageId={lastId} variant="composer" />;
};
