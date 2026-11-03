"use client";

import { ArrowLeft, Check, Code2, Copy, Database, Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format as formatSql } from "sql-formatter";
import { ResultsGrid } from "@/components/fontes/sql/results-grid";
import { SaveDatasetDialog } from "@/components/fontes/sql/save-dataset-dialog";
import { EmptyState } from "@/components/sigdata/list-states";
import { LogoMark } from "@/components/sigdata/logo";
import { ThemeToggle } from "@/components/sigdata/theme-toggle";
import { Button } from "@/components/ui/button";
import { useDatasetsStore } from "@/lib/datasets/store";
import { confirmAction, toast } from "@/lib/feedback";
import type { StepType } from "@/lib/domain/transform";
import { usePreparoStore } from "@/lib/preparo/store";
import { ColumnHeader } from "./column-menu";
import { FormulaBar } from "./formula-bar";
import { NewQueryDialog } from "./new-query-dialog";
import { QueriesPanel } from "./queries-panel";
import { Ribbon, type PanelKey, type RibbonContext } from "./ribbon";
import { SchemaView } from "./schema-view";
import { StatusBar } from "./status-bar";
import { StepDialog, type StepDialogMode } from "./step-dialog";
import { StepsPanel } from "./steps-panel";

const prettySql = (sql: string) => {
  try {
    return formatSql(sql, { language: "postgresql", keywordCase: "upper", tabWidth: 2 });
  } catch {
    return sql;
  }
};

/** Preparação de dados em etapas (estilo Power Query): faixa de opções, consultas, grade, fórmula e etapas. */
export const PrepWorkspace = ({
  initialSourceId,
  initialTable,
  initialDatasetId,
}: {
  initialSourceId: string | null;
  initialTable: string | null;
  initialDatasetId: string | null;
}) => {
  const datasets = useDatasetsStore((state) => state.datasets);
  const hydrated = useDatasetsStore((state) => state.hydrated);
  const loadError = useDatasetsStore((state) => state.error);
  const hydrate = useDatasetsStore((state) => state.hydrate);
  const createDataset = useDatasetsStore((state) => state.createDataset);

  const { queries, activeId, viewAt, page, pageSize, result, profile, loading, error, selectedColumn } = usePreparoStore();
  const store = usePreparoStore.getState();

  const [dialog, setDialog] = useState<StepDialogMode | null>(null);
  const [newQueryOpen, setNewQueryOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<"grade" | "esquema">("grade");
  const [shown, setShown] = useState<Record<PanelKey, boolean>>({ queries: true, formula: true, steps: true, status: true, sql: false });

  const ready = useMemo(() => datasets.filter((dataset) => dataset.status === "pronta"), [datasets]);
  const active = queries.find((query) => query.id === activeId) ?? null;
  const source = ready.find((dataset) => dataset.id === active?.sourceId) ?? null;
  const origin = initialDatasetId ? datasets.find((dataset) => dataset.id === initialDatasetId) : null;
  const steps = active?.steps ?? [];
  const applied = viewAt ?? steps.length;

  useEffect(() => {
    hydrate();
    return () => usePreparoStore.getState().reset();
  }, [hydrate]);

  // abre o que a URL pediu: o espaço de trabalho de um dataset, uma fonte/tabela ou a primeira fonte pronta
  useEffect(() => {
    if (usePreparoStore.getState().queries.length > 0 || !hydrated || ready.length === 0) return;
    const saved = initialDatasetId ? ready.find((dataset) => dataset.id === initialDatasetId) : null;
    if (saved?.definition?.workspace) return usePreparoStore.getState().load(saved.definition.workspace);
    // sem pedido na URL, começa por uma fonte de dados (e não por um dataset já tratado)
    const target = ready.find((dataset) => dataset.id === initialSourceId) ?? ready.find((dataset) => dataset.kind !== "dataset") ?? ready[0]!;
    const tableName = target.tables.find((entry) => entry.name === initialTable)?.name ?? target.tables[0]?.name;
    if (tableName) usePreparoStore.getState().addQuery({ sourceId: target.id, table: tableName });
  }, [hydrated, ready, initialDatasetId, initialSourceId, initialTable]);

  const removeQuery = useCallback(async (id: string) => {
    const state = usePreparoStore.getState();
    const dependents = state.dependentsOf(id);
    const name = state.queries.find((query) => query.id === id)?.name ?? "a consulta";
    const ok = await confirmAction({
      title: `Excluir a consulta “${name}”?`,
      description:
        dependents.length > 0
          ? `As etapas que combinam com ela em ${dependents.map((query) => `“${query.name}”`).join(", ")} também serão removidas. As fontes originais não são afetadas.`
          : "As fontes originais não são afetadas.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (ok) usePreparoStore.getState().removeQuery(id);
  }, []);

  const copySql = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(prettySql(result.sql));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar o SQL.");
    }
  };

  const canSave = Boolean(active && result && steps.length > 0 && !error && !loading);

  const save = async (input: { name: string; description: string }) => {
    if (!activeId) return;
    const created = await createDataset({ workspace: { queries, target: activeId }, ...input });
    toast.success(`Dataset "${created.name}" salvo.`);
  };

  const ribbon: RibbonContext = {
    column: selectedColumn,
    hasQuery: Boolean(active),
    canSave,
    shown,
    view,
    open: setDialog,
    add: store.addStep,
    newQuery: () => setNewQueryOpen(true),
    refresh: store.refresh,
    save: () => setSaveOpen(true),
    togglePanel: (panel) => setShown((current) => ({ ...current, [panel]: !current[panel] })),
    setView,
  };

  const formula =
    !active || !result
      ? null
      : applied === 0
        ? `SELECT * FROM "${active.table}"`
        : (result.stepSql[Math.min(applied, result.stepSql.length) - 1] ?? null);

  const body = !hydrated ? (
    <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Carregando fontes…
    </div>
  ) : loadError ? (
    <div className="flex flex-1 items-center justify-center p-6 text-sm text-destructive">{loadError}</div>
  ) : ready.length === 0 ? (
    <div className="flex flex-1 items-center justify-center p-6">
      <EmptyState
        icon={Database}
        title="Nenhuma fonte pronta"
        description="Envie um CSV/XLSX ou conecte um banco em Fontes de dados. Depois volte aqui para tratar os dados."
        action={
          <Button render={<Link href="/fontes-de-dados" />} nativeButton={false}>
            Ir para Fontes de dados
          </Button>
        }
      />
    </div>
  ) : (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {shown.queries ? (
        <QueriesPanel
          queries={queries}
          activeId={activeId}
          onSelect={store.setActive}
          onAdd={() => setNewQueryOpen(true)}
          onRename={store.renameQuery}
          onDuplicate={store.duplicateQuery}
          onRemove={(id) => void removeQuery(id)}
        />
      ) : null}

      <section className="flex min-h-72 min-w-0 flex-1 flex-col" aria-label="Prévia dos dados">
        {shown.formula ? <FormulaBar text={formula} /> : null}

        {error ? (
          <div role="alert" className="flex shrink-0 items-start gap-2 border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              {error.message}
              {error.stepIndex !== null && result ? ` A grade mostra os dados até a etapa ${error.stepIndex}.` : ""}
            </span>
          </div>
        ) : viewAt !== null && viewAt < steps.length ? (
          <div className="shrink-0 border-b border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
            {viewAt === 0 ? "Mostrando a tabela original." : `Mostrando os dados até a etapa ${viewAt}.`}{" "}
            <button type="button" className="text-primary hover:underline" onClick={() => store.viewStep(null)}>
              Ver o resultado final
            </button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1">
          {result ? (
            view === "esquema" ? (
              <SchemaView columns={result.columns} profile={profile} selected={selectedColumn} onSelect={store.selectColumn} />
            ) : (
              <ResultsGrid
                columns={result.columns}
                rows={result.rows}
                title={active?.name ?? "dados"}
                loading={loading}
                pagination={{
                  page,
                  pageSize,
                  total: result.total,
                  hasMore: result.hasMore,
                  onPage: store.setPage,
                  onPageSize: store.setPageSize,
                }}
                renderColumnHeader={(column) => (
                  <ColumnHeader
                    column={column}
                    profile={profile[column.name]}
                    selected={selectedColumn === column.name}
                    onSelect={() => store.selectColumn(column.name)}
                    onOpen={setDialog}
                    onAdd={store.addStep}
                  />
                )}
              />
            )
          ) : error ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">Não foi possível montar a prévia.</div>
          ) : (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Carregando dados…
            </div>
          )}
        </div>

        {shown.sql && result ? (
          <div className="max-h-56 shrink-0 overflow-auto border-t border-border bg-muted/30">
            <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground">
              <span>SQL completo gerado pelas etapas (somente leitura)</span>
              <span className="flex items-center gap-1">
                <Button size="xs" variant="ghost" onClick={() => void copySql()}>
                  {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
                {source ? (
                  <Button
                    size="xs"
                    variant="ghost"
                    render={<Link href={`/fontes-de-dados/editor?${new URLSearchParams({ source: source.id, sql: result.sql })}`} />}
                    nativeButton={false}
                  >
                    <Code2 aria-hidden />
                    Abrir no editor SQL
                  </Button>
                ) : null}
              </span>
            </div>
            <pre className="px-3 pb-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground">{prettySql(result.sql)}</pre>
          </div>
        ) : null}
      </section>

      {shown.steps && active ? (
        <StepsPanel
          queryName={active.name}
          origin={`${source?.name ?? "fonte removida"} · ${active.table}`}
          onRename={(name) => store.renameQuery(active.id, name)}
          table={active.table}
          steps={steps}
          applied={applied}
          errorIndex={error?.stepIndex ?? null}
          onView={store.viewStep}
          onAdd={(type: StepType) => setDialog({ kind: "new", type })}
          onEdit={(index) => setDialog({ kind: "edit", step: steps[index]!, index })}
          onRemove={store.removeStep}
          onMove={store.moveStep}
        />
      ) : null}
    </div>
  );

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background text-foreground">
      <header className="z-20 shrink-0 border-b border-border/60 bg-card/70 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-4 sm:gap-6 sm:px-6">
          <Link
            href="/fontes-de-dados"
            aria-label="Voltar para Fontes de dados"
            className="grid size-9 shrink-0 place-items-center rounded-md border border-border/70 text-foreground transition-colors hover:bg-muted/60"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
          <LogoMark className="h-9 w-auto shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-foreground">Preparar dados</h1>
            <p className="truncate text-xs text-muted-foreground">
              {origin?.definition?.workspace
                ? `Etapas de “${origin.name}” abertas para edição; salvar cria um novo dataset`
                : "Filtre, limpe, combine e resuma em etapas, sem escrever SQL. As fontes originais só são lidas"}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <Ribbon ctx={ribbon} />
      {body}

      {shown.status ? (
        <StatusBar
          columns={result?.columns.length ?? null}
          rows={result ? (result.total ?? result.rows.length) : null}
          hasMoreRows={Boolean(result && result.total === null && result.hasMore)}
          errors={error ? 1 : 0}
          step={applied}
          steps={steps.length}
          durationMs={result?.durationMs ?? null}
          loading={loading}
        />
      ) : null}

      <StepDialog mode={dialog} tables={source?.tables ?? []} currentTable={active?.table ?? ""} onClose={() => setDialog(null)} />
      <NewQueryDialog
        open={newQueryOpen}
        sources={ready}
        defaultSourceId={active?.sourceId ?? null}
        onClose={() => setNewQueryOpen(false)}
        onCreate={(input) => {
          store.addQuery(input);
          setNewQueryOpen(false);
        }}
      />
      {result ? (
        <SaveDatasetDialog
          open={saveOpen}
          onOpenChange={setSaveOpen}
          sql={prettySql(result.sql)}
          rowCount={result.total ?? result.rows.length}
          initialName={origin ? `${origin.name} (editado)` : active ? `${active.name} tratado` : ""}
          onSave={save}
        />
      ) : null}
    </div>
  );
};
