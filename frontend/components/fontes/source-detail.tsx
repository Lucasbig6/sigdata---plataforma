"use client";

import { Loader2, Play, RefreshCw, Table2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ResultTable } from "@/components/sigdata/visualizations";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { useDatasetsStore } from "@/lib/datasets/store";
import type {
  AnalyticResult,
  ColumnKind,
  DataSource,
  SourceTable,
  TablePreview,
} from "@/lib/domain/sources";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<ColumnKind, string> = {
  numero: "número",
  texto: "texto",
  data: "data",
  booleano: "booleano",
  outro: "outro",
};

const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

const ColumnsTable = ({ table }: { table: SourceTable }) => (
  <div className="overflow-x-auto rounded-xl border border-border">
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-muted/60 text-muted-foreground">
          <th className="px-3 py-2 text-left font-medium">Coluna</th>
          <th className="px-3 py-2 text-left font-medium">Tipo</th>
          <th className="px-3 py-2 text-right font-medium">Nulos</th>
          <th className="px-3 py-2 text-right font-medium">Distintos</th>
          <th className="px-3 py-2 text-left font-medium">Mín. / Máx.</th>
          <th className="px-3 py-2 text-right font-medium">Média</th>
        </tr>
      </thead>
      <tbody>
        {table.columns.map((column) => {
          const p = column.profile;
          return (
            <tr key={column.name} className="border-t border-border">
              <td className="px-3 py-2 font-mono text-[11px] text-foreground">{column.name}</td>
              <td className="px-3 py-2">
                <span className="rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground" title={column.dbType}>
                  {KIND_LABEL[column.kind]}
                </span>
              </td>
              <td
                className={cn(
                  "px-3 py-2 text-right tabular-nums",
                  p && p.nulosPct >= 20 ? "text-destructive" : "text-foreground",
                )}
              >
                {p ? `${nf.format(p.nulosPct)}%` : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{p?.distintos != null ? nf.format(p.distintos) : "—"}</td>
              <td className="max-w-56 truncate px-3 py-2 text-muted-foreground" title={p ? `${p.min} — ${p.max}` : ""}>
                {p && (p.min || p.max) ? `${p.min ?? "—"} — ${p.max ?? "—"}` : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{p?.media != null ? nf.format(p.media) : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export const SourceDetail = ({ source, onClose }: { source: DataSource; onClose: () => void }) => {
  const profileTable = useDatasetsStore((state) => state.profileTable);
  const refreshSchema = useDatasetsStore((state) => state.refreshSchema);

  const [tableName, setTableName] = useState(source.tables[0]?.name ?? null);
  const [tab, setTab] = useState<"colunas" | "amostra">("colunas");
  const [preview, setPreview] = useState<TablePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sql, setSql] = useState("");
  const [result, setResult] = useState<AnalyticResult | null>(null);
  const [running, setRunning] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  const table = source.tables.find((entry) => entry.name === tableName) ?? null;
  const needsProfile = Boolean(table && table.columns.some((column) => !column.profile));

  // só ao trocar de fonte (o perfil calculado também atualiza `source.tables`)
  const firstTable = source.tables[0]?.name ?? null;
  useEffect(() => {
    setTableName(firstTable);
    setResult(null);
    setSql(firstTable ? `SELECT *\nFROM ${firstTable}\nLIMIT 100` : "");
  }, [source.id, firstTable]);

  useEffect(() => {
    if (!tableName) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const tasks: Promise<unknown>[] = [];
    if (tab === "amostra") {
      tasks.push(
        api<TablePreview>(`/api/sources/${source.id}/preview?table=${encodeURIComponent(tableName)}`).then(
          (out) => !cancelled && setPreview(out),
        ),
      );
    } else if (needsProfile) {
      tasks.push(profileTable(source.id, tableName));
    }
    Promise.all(tasks)
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [source.id, tableName, tab, needsProfile, profileTable]);

  const runQuery = async () => {
    setRunning(true);
    setQueryError(null);
    try {
      setResult(
        await api<AnalyticResult>(`/api/sources/${source.id}/query`, {
          method: "POST",
          json: { sql, title: "Consulta manual" },
        }),
      );
    } catch (err) {
      setQueryError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-primary/30 bg-card/70 p-4">
      <header className="mb-4 flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-foreground">{source.name}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {source.connectionLabel ?? source.fileName ?? source.description ?? ""}
          </p>
        </div>
        {source.kind === "postgresql" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void refreshSchema(source.id).catch((err: Error) => setError(err.message))}
          >
            <RefreshCw aria-hidden />
            Reler schema
          </Button>
        ) : null}
        <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Fechar inspeção">
          <X aria-hidden />
        </Button>
      </header>

      {source.tables.length === 0 ? (
        <p className="text-xs text-muted-foreground">Esta fonte não tem tabelas.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <ul className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            {source.tables.map((entry) => (
              <li key={entry.name}>
                <button
                  type="button"
                  onClick={() => setTableName(entry.name)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-xs transition-colors",
                    entry.name === tableName
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <Table2 className="size-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-mono">{entry.name}</span>
                  {entry.rowCount != null ? (
                    <span className="shrink-0 tabular-nums text-[10px]">{nf.format(entry.rowCount)}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>

          <div className="min-w-0 space-y-3">
            <div className="flex items-center gap-2">
              {(["colunas", "amostra"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    tab === value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {value === "colunas" ? "Colunas e qualidade" : "Amostra (50 linhas)"}
                </button>
              ))}
              {loading ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden /> : null}
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            {table && tab === "colunas" ? <ColumnsTable table={table} /> : null}
            {tab === "amostra" && preview && preview.table === tableName ? (
              <div className="max-h-96 overflow-auto">
                <ResultTable columns={preview.columns.map((c) => c.name)} rows={preview.rows} />
              </div>
            ) : null}
          </div>
        </div>
      )}

      {source.definition ? (
        <div className="mt-4 space-y-1.5 rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">
            Dataset criado a partir de <strong className="text-foreground">{source.definition.sourceName}</strong> ·{" "}
            {nf.format(source.definition.rowCount)} linhas
          </p>
          <pre className="max-h-40 overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground">
            {source.definition.sql}
          </pre>
        </div>
      ) : null}

      <div className="mt-5 space-y-2 border-t border-border/60 pt-4">
        <label htmlFor="sql-console" className="text-xs font-medium text-muted-foreground">
          Consulta SQL (somente leitura · {source.kind === "postgresql" ? "PostgreSQL" : "DuckDB"})
        </label>
        <Textarea
          id="sql-console"
          value={sql}
          onChange={(event) => setSql(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") void runQuery();
          }}
          className="min-h-24 font-mono text-xs"
          spellCheck={false}
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void runQuery()} disabled={running || !sql.trim()}>
            {running ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
            Executar
          </Button>
          <span className="text-[11px] text-muted-foreground">Ctrl+Enter</span>
          {result ? (
            <span className="text-[11px] text-muted-foreground">
              {result.rowCount} linha(s){result.truncated ? " (truncado)" : ""} · {result.durationMs} ms
            </span>
          ) : null}
        </div>
        {queryError ? <p className="text-xs text-destructive">{queryError}</p> : null}
        {result ? (
          <div className="max-h-96 overflow-auto">
            <ResultTable columns={result.columns.map((c) => c.name)} rows={result.rows.slice(0, 200)} />
          </div>
        ) : null}
      </div>
    </section>
  );
};
