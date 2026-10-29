"use client";

import {
  AlignLeft,
  ArrowLeft,
  Check,
  Database,
  History,
  Keyboard,
  Loader2,
  PanelLeft,
  Play,
  Save,
  Table2,
  X,
} from "lucide-react";
import Link from "next/link";
import { format as formatSql } from "sql-formatter";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { LogoMark } from "@/components/sigdata/logo";
import { ThemeToggle } from "@/components/sigdata/theme-toggle";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { useDatasetsStore } from "@/lib/datasets/store";
import type { DataSource, ResultColumn } from "@/lib/domain/sources";
import { useScriptsStore } from "@/lib/sql-editor/scripts";
import { cn } from "@/lib/utils";
import { CodeEditor, type EditorHandle } from "./sql/code-editor";
import { ResultsGrid } from "./sql/results-grid";
import { SaveDatasetDialog } from "./sql/save-dataset-dialog";
import { SchemaNavigator } from "./sql/schema-navigator";
import { ScriptTabs } from "./sql/script-tabs";
import { ShortcutsDialog } from "./sql/shortcuts-dialog";

type RunOutput = {
  columns: ResultColumn[];
  rows: Record<string, unknown>[];
  /** Há mais linhas depois desta página. */
  hasMore: boolean;
  durationMs: number;
  page: number;
  pageSize: number;
  /** Total de linhas do resultado; null se não pôde ser contado. */
  total: number | null;
};

/** Estado da última execução de cada script. */
type RunState = {
  running: boolean;
  /** Instrução executada (é o que "Salvar como dataset" grava). */
  sql: string | null;
  output: RunOutput | null;
  error: string | null;
};

type HistoryItem = {
  id: string;
  at: number;
  script: string;
  sourceName: string;
  sql: string;
  ok: boolean;
  detail: string;
};

const IDLE: RunState = { running: false, sql: null, output: null, error: null };
const MIN_RESULTS = 96;
const HISTORY_LIMIT = 60;

const starterSql = (source: DataSource | undefined | null) => {
  const table = source?.tables[0]?.name;
  return table ? `SELECT *\nFROM ${table}\nLIMIT 100;` : "";
};

const dialectOf = (source: DataSource | null) => (source?.kind === "postgresql" ? "PostgreSQL" : "DuckDB");

export const SqlEditor = ({
  initialSourceId,
  initialSql,
}: {
  initialSourceId: string | null;
  initialSql: string | null;
}) => {
  const datasets = useDatasetsStore((state) => state.datasets);
  const hydrated = useDatasetsStore((state) => state.hydrated);
  const loadError = useDatasetsStore((state) => state.error);
  const hydrate = useDatasetsStore((state) => state.hydrate);
  const createDataset = useDatasetsStore((state) => state.createDataset);

  const scriptsHydrated = useScriptsStore((state) => state.hydrated);
  const hydrateScripts = useScriptsStore((state) => state.hydrate);
  const scripts = useScriptsStore((state) => state.scripts);
  const activeId = useScriptsStore((state) => state.activeId);
  const { open, close, setActive, setSql, setSource, rename } = useScriptsStore.getState();

  const ready = useMemo(() => datasets.filter((dataset) => dataset.status === "pronta"), [datasets]);
  const script = scripts.find((entry) => entry.id === activeId) ?? null;
  const source = ready.find((dataset) => dataset.id === script?.sourceId) ?? null;

  const [runs, setRuns] = useState<Record<string, RunState>>({});
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [bottomTab, setBottomTab] = useState<"resultado" | "historico">("resultado");
  const [pageSize, setPageSize] = useState(100);
  const [navOpen, setNavOpen] = useState(true);
  const [resultsHeight, setResultsHeight] = useState(300);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [saveOpen, setSaveOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const handle = useRef<EditorHandle | null>(null);
  const column = useRef<HTMLDivElement>(null);
  const bootstrapped = useRef(false);
  const run = (script && runs[script.id]) || IDLE;

  useEffect(() => {
    hydrate();
    hydrateScripts();
  }, [hydrate, hydrateScripts]);

  // abre o script pedido pela URL (fonte escolhida, SQL de um dataset) ou garante um script inicial
  useEffect(() => {
    if (bootstrapped.current || !hydrated || !scriptsHydrated || ready.length === 0) return;
    bootstrapped.current = true;
    const store = useScriptsStore.getState();
    const target = ready.find((dataset) => dataset.id === initialSourceId) ?? null;
    if (initialSql && target) {
      store.open({ sourceId: target.id, sql: initialSql });
    } else if (target) {
      const existing = store.scripts.find((entry) => entry.sourceId === target.id);
      if (existing) store.setActive(existing.id);
      else store.open({ sourceId: target.id, sql: starterSql(target) });
    } else if (store.scripts.length === 0) {
      store.open({ sourceId: ready[0].id, sql: starterSql(ready[0]) });
    }
  }, [hydrated, scriptsHydrated, ready, initialSourceId, initialSql]);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(timeout);
  }, [notice]);

  const setRun = useCallback((id: string, patch: Partial<RunState>) => {
    setRuns((current) => ({ ...current, [id]: { ...(current[id] ?? IDLE), ...patch } }));
  }, []);

  const pushHistory = (item: Omit<HistoryItem, "id" | "at">) =>
    setHistory((current) => [{ ...item, id: crypto.randomUUID(), at: Date.now() }, ...current].slice(0, HISTORY_LIMIT));

  const execute = useCallback(
    async (
      text: string,
      target = script,
      targetSource = source,
      opts: { page?: number; pageSize?: number; keepTotal?: boolean } = {},
    ) => {
      if (!target) return;
      const statement = text.trim().replace(/;+\s*$/, "");
      if (!statement) {
        setRun(target.id, { ...IDLE, error: "Escreva uma consulta (ou posicione o cursor sobre uma) para executar." });
        setBottomTab("resultado");
        return;
      }
      if (!targetSource) {
        setRun(target.id, { ...IDLE, error: "Escolha uma fonte de dados na barra superior." });
        setBottomTab("resultado");
        return;
      }
      setBottomTab("resultado");
      setRun(target.id, { running: true, error: null });
      const page = opts.page ?? 1;
      // mesma consulta (virar a página, mudar o tamanho): o total já é conhecido, não conta de novo
      const keepTotal = opts.keepTotal ?? false;
      try {
        const output = await api<RunOutput>(`/api/sources/${targetSource.id}/run`, {
          method: "POST",
          json: { sql: statement, page, pageSize: opts.pageSize ?? pageSize, count: !keepTotal },
        });
        setRuns((current) => {
          const previous = current[target.id]?.output;
          const total = keepTotal ? (previous?.total ?? null) : output.total;
          return { ...current, [target.id]: { running: false, sql: statement, output: { ...output, total }, error: null } };
        });
        if (!keepTotal) {
          pushHistory({
            script: target.name,
            sourceName: targetSource.name,
            sql: statement,
            ok: true,
            detail: `${(output.total ?? output.rows.length).toLocaleString("pt-BR")} linha(s) · ${output.durationMs} ms`,
          });
        }
      } catch (error) {
        const message = (error as Error).message;
        setRun(target.id, { running: false, sql: null, output: null, error: message });
        pushHistory({ script: target.name, sourceName: targetSource.name, sql: statement, ok: false, detail: message });
      }
    },
    [script, source, setRun, pageSize],
  );

  // o editor chama sempre a versão mais recente, sem ser recriado
  const executeRef = useRef(execute);
  executeRef.current = execute;

  /** Vira a página ou muda o tamanho do mesmo resultado (reexecuta a consulta já executada). */
  const goToPage = (page: number, size = pageSize) => {
    if (!run.sql) return;
    void execute(run.sql, script, source, { page, pageSize: size, keepTotal: true });
  };

  const changePageSize = (size: number) => {
    setPageSize(size);
    goToPage(1, size);
  };

  const onRunText = useCallback((text: string) => void executeRef.current(text), []);

  const formatDocument = useCallback(() => {
    const editor = handle.current;
    if (!editor) return;
    try {
      editor.replace((text) =>
        formatSql(text, { language: "postgresql", keywordCase: "upper", tabWidth: 2, linesBetweenQueries: 1 }),
      );
    } catch {
      setNotice({ ok: false, text: "Não foi possível formatar: confira a sintaxe do SQL." });
    }
  }, []);

  const newScript = () => {
    open({ sourceId: source?.id ?? ready[0]?.id ?? null, sql: "" });
    requestAnimationFrame(() => handle.current?.focus());
  };

  const closeScript = (id: string) => {
    const wasLast = useScriptsStore.getState().scripts.length === 1;
    close(id);
    setRuns((current) => {
      const { [id]: _removed, ...rest } = current;
      return rest;
    });
    if (wasLast) open({ sourceId: source?.id ?? ready[0]?.id ?? null, sql: "" });
  };

  const previewTable = (table: string) => {
    if (!source) return;
    const sql = `SELECT *\nFROM ${table}\nLIMIT 100;`;
    const id = open({ sourceId: source.id, sql, name: table.split(".").pop() });
    const created = useScriptsStore.getState().scripts.find((entry) => entry.id === id);
    if (created) void executeRef.current(sql, created, source);
  };

  const changeSource = (id: string) => {
    if (!script) return;
    setSource(script.id, id);
    // script ainda vazio: oferece um ponto de partida na nova fonte
    if (!script.sql.trim()) setSql(script.id, starterSql(ready.find((dataset) => dataset.id === id)));
    setRun(script.id, { ...IDLE });
  };

  const saveDataset = async (input: { name: string; description: string }) => {
    if (!source || !run.sql) return;
    const dataset = await createDataset({ sourceId: source.id, sql: run.sql, ...input });
    setNotice({
      ok: true,
      text: `Dataset "${dataset.name}" criado com ${(dataset.definition?.rowCount ?? 0).toLocaleString("pt-BR")} linhas. Escolha-o na barra lateral de um projeto para analisar.`,
    });
  };

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = resultsHeight;
    const total = column.current?.clientHeight ?? 700;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    const onMove = (move: PointerEvent) => {
      const next = startHeight + (startY - move.clientY);
      setResultsHeight(Math.min(Math.max(next, MIN_RESULTS), total - 200));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  const runningIds = useMemo(
    () => new Set(Object.entries(runs).filter(([, state]) => state.running).map(([id]) => id)),
    [runs],
  );

  if (!hydrated || !scriptsHydrated) {
    return (
      <div className="flex h-dvh items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Carregando editor…
      </div>
    );
  }

  if (loadError) {
    return (
      <div role="alert" className="flex h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-destructive">{loadError}</p>
        <Button size="sm" variant="outline" onClick={hydrate}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (ready.length === 0) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <Database className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium text-foreground">Nenhuma fonte disponível</p>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          Envie um CSV/XLSX ou conecte um banco para consultar e tratar os dados aqui.
        </p>
        <Link href="/fontes-de-dados" className="text-xs font-medium text-primary hover:underline">
          Ir para Fontes de dados
        </Link>
      </div>
    );
  }

  const canRun = Boolean(source && script?.sql.trim() && !run.running);

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background text-foreground">
      {/* cabeçalho: mesmo padrão das outras telas */}
      <header className="z-20 shrink-0 border-b border-border/60 bg-card/70 backdrop-blur">
        <div className="flex h-16 items-center gap-2 px-4 sm:gap-7 sm:px-6">
          <Link
            href="/fontes-de-dados"
            aria-label="Voltar para Fontes de dados"
            className="grid size-10 shrink-0 place-items-center rounded-md border border-border/70 text-foreground transition-colors hover:bg-muted/60"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
          <LogoMark className="h-10 w-auto shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-foreground">Editor SQL</h1>
            <p className="truncate text-xs text-muted-foreground">
              Consulte, trate os dados e salve datasets para usar nas análises
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setHelpOpen(true)}
              aria-label="Atalhos e modelos"
              title="Atalhos e modelos"
            >
              <Keyboard aria-hidden />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* barra de ferramentas do editor */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-muted/30 px-3">
        <button
          type="button"
          onClick={() => setNavOpen((value) => !value)}
          aria-pressed={navOpen}
          aria-label="Alternar navegador de tabelas"
          title="Navegador de tabelas"
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-md transition-colors hover:bg-muted",
            navOpen ? "text-primary" : "text-muted-foreground",
          )}
        >
          <PanelLeft className="size-4" aria-hidden />
        </button>
        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />

        <label className="flex min-w-0 items-center gap-1.5">
          <Database className="size-3.5 shrink-0 text-primary" aria-hidden />
          <span className="sr-only">Fonte de dados</span>
          <select
            value={source?.id ?? ""}
            onChange={(event) => changeSource(event.target.value)}
            className="h-8 max-w-56 min-w-0 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {!source ? <option value="">Escolha uma fonte…</option> : null}
            {ready.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.name}
              </option>
            ))}
          </select>
        </label>

        <Button
          size="sm"
          disabled={!canRun}
          onClick={() => void execute(handle.current?.getRunnable() ?? "")}
          title="Executa a seleção ou a instrução sob o cursor (Ctrl+Enter)"
        >
          {run.running ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
          Executar
        </Button>
        <Button size="sm" variant="outline" onClick={formatDocument} title="Formatar SQL (Ctrl+Shift+F)">
          <AlignLeft aria-hidden />
          <span className="hidden md:inline">Formatar</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!run.output || !run.sql}
          onClick={() => setSaveOpen(true)}
          title={run.output ? "Salvar o resultado como dataset" : "Execute uma consulta para poder salvar"}
        >
          <Save aria-hidden />
          <span className="hidden md:inline">Salvar como dataset</span>
        </Button>
      </div>

      {notice ? (
        <div
          role="status"
          className={cn(
            "flex shrink-0 items-center gap-2 border-b px-3 py-1.5 text-xs",
            notice.ok ? "border-primary/30 bg-primary/10 text-foreground" : "border-destructive/30 bg-destructive/10 text-destructive",
          )}
        >
          {notice.ok ? <Check className="size-3.5 shrink-0 text-primary" aria-hidden /> : null}
          <span className="min-w-0 flex-1">{notice.text}</span>
          {notice.ok ? (
            <Link href="/fontes-de-dados?aba=datasets" className="shrink-0 font-medium text-primary hover:underline">
              Ver em Datasets
            </Link>
          ) : null}
          <button type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso" className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {navOpen && source ? (
          <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:block" aria-label="Navegador de tabelas">
            <SchemaNavigator
              key={source.id}
              source={source}
              onInsert={(text) => handle.current?.insert(text)}
              onPreview={previewTable}
            />
          </aside>
        ) : null}

        <div ref={column} className="flex min-w-0 flex-1 flex-col">
          <ScriptTabs
            scripts={scripts}
            activeId={activeId}
            runningIds={runningIds}
            onSelect={setActive}
            onClose={closeScript}
            onRename={rename}
            onNew={newScript}
          />

          {/* editor */}
          <div className="min-h-32 flex-1 overflow-hidden bg-card">
            {script ? (
              <CodeEditor
                docKey={script.id}
                value={script.sql}
                source={source}
                onChange={(value) => setSql(script.id, value)}
                onRun={onRunText}
                onFormat={formatDocument}
                onCursor={(line, col) => setCursor({ line, col })}
                handleRef={handle}
              />
            ) : null}
          </div>

          {/* divisor arrastável */}
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Redimensionar resultados"
            onPointerDown={startResize}
            className="h-1.5 shrink-0 cursor-row-resize border-y border-border bg-muted transition-colors hover:bg-primary/40 active:bg-primary/60"
          />

          {/* resultados */}
          <section className="flex shrink-0 flex-col bg-card" style={{ height: resultsHeight }} aria-label="Resultados">
            <div role="tablist" className="flex h-8 shrink-0 items-center gap-1 border-b border-border bg-muted/50 px-2 text-xs">
              {(
                [
                  { id: "resultado", label: "Resultado", icon: Table2, count: run.output ? (run.output.total ?? run.output.rows.length) : undefined },
                  { id: "historico", label: "Histórico", icon: History, count: history.length },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={bottomTab === tab.id}
                  onClick={() => setBottomTab(tab.id)}
                  className={cn(
                    "flex h-6 items-center gap-1.5 rounded-md px-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                    bottomTab === tab.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <tab.icon className="size-3.5" aria-hidden />
                  {tab.label}
                  {tab.count ? <span className="text-[10px] text-muted-foreground tabular-nums">{tab.count.toLocaleString("pt-BR")}</span> : null}
                </button>
              ))}
              {run.output ? (
                <span className="ms-auto pe-1 text-[11px] text-muted-foreground">
                  {run.output.columns.length} coluna(s) · {run.output.durationMs} ms
                </span>
              ) : null}
            </div>

            <div className="min-h-0 flex-1">
              {bottomTab === "historico" ? (
                history.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-muted-foreground">As consultas executadas nesta sessão aparecem aqui.</p>
                ) : (
                  <ul className="h-full overflow-auto">
                    {history.map((item) => (
                      <li key={item.id} className="border-b border-border/60">
                        <button
                          type="button"
                          onClick={() => {
                            open({ sourceId: source?.id ?? null, sql: item.sql });
                            setBottomTab("resultado");
                          }}
                          title="Abrir em um script novo"
                          className="flex w-full flex-col gap-0.5 px-3 py-1.5 text-start outline-none hover:bg-muted/60 focus-visible:bg-muted/60"
                        >
                          <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className={cn("size-1.5 rounded-full", item.ok ? "bg-primary" : "bg-destructive")} aria-hidden />
                            {new Date(item.at).toLocaleTimeString("pt-BR")} · {item.script} · {item.sourceName}
                            <span className={cn("truncate", !item.ok && "text-destructive")}>{item.detail}</span>
                          </span>
                          <code className="line-clamp-2 font-mono text-xs whitespace-pre-wrap text-foreground">{item.sql}</code>
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : run.running && !run.output ? (
                <p className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Executando…
                </p>
              ) : run.error ? (
                <pre role="alert" className="h-full overflow-auto p-3 font-mono text-xs whitespace-pre-wrap text-destructive">
                  {run.error}
                </pre>
              ) : run.output ? (
                run.output.rows.length === 0 && run.output.page === 1 ? (
                  <p className="px-4 py-8 text-center text-xs text-muted-foreground">A consulta executou, mas não retornou linhas.</p>
                ) : (
                  <ResultsGrid
                    columns={run.output.columns}
                    rows={run.output.rows}
                    title={script?.name ?? "resultado"}
                    loading={run.running}
                    pagination={{
                      page: run.output.page,
                      pageSize: run.output.pageSize,
                      total: run.output.total,
                      hasMore: run.output.hasMore,
                      onPage: goToPage,
                      onPageSize: changePageSize,
                    }}
                  />
                )
              ) : (
                <p className="px-4 py-8 text-center text-xs leading-relaxed text-muted-foreground">
                  Execute uma consulta com <kbd className="rounded border border-border bg-muted px-1 font-mono">Ctrl</kbd>+
                  <kbd className="rounded border border-border bg-muted px-1 font-mono">Enter</kbd>. Trate os dados com SQL
                  (filtros, junções, cálculos) e salve o resultado como dataset para usar nas análises.
                </p>
              )}
            </div>
          </section>

          {/* barra de status */}
          <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-muted px-3 text-[11px] text-muted-foreground">
            <span className="tabular-nums">
              Ln {cursor.line}, Col {cursor.col}
            </span>
            <span>{dialectOf(source)}</span>
            <span className="min-w-0 flex-1 truncate">{source?.name ?? "Sem fonte"}</span>
            <span>Somente leitura</span>
          </footer>
        </div>
      </div>

      <SaveDatasetDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        sql={run.sql ?? ""}
        rowCount={run.output ? (run.output.total ?? run.output.rows.length) : 0}
        onSave={saveDataset}
      />
      <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
};
