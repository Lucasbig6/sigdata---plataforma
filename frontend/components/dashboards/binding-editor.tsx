"use client";

import { Loader2, MessageSquareText, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api/client";
import { AGG_LABELS, builderFor } from "@/lib/dashboards/auto-binding";
import { axesOf, isBindingReady, useBindingData, useDashboardData } from "@/lib/dashboards/live-data";
import type {
  Aggregation,
  BindingSort,
  DataBinding,
  ElementType,
  FilterBinding,
} from "@/lib/dashboards/types";
import { useDatasetsStore } from "@/lib/datasets/store";
import type { ResultColumn, SourceTable } from "@/lib/domain/sources";

export const inputCls =
  "w-full rounded-md border border-border/70 bg-background px-2 py-1.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/50";

const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label className="flex min-w-0 flex-col gap-1">
    <span className="text-[11px] text-muted-foreground">{label}</span>
    {children}
    {hint ? <span className="text-[10px] leading-snug text-muted-foreground/80">{hint}</span> : null}
  </label>
);

const Select = ({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) => (
  <select className={`${inputCls} cursor-pointer`} value={value} onChange={(e) => onChange(e.target.value)}>
    {children}
  </select>
);

const Tabs = <T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) => (
  <div className="flex gap-0.5 rounded-md border border-border/70 bg-muted/40 p-0.5">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        className={`flex-1 rounded-[5px] px-1.5 py-1 text-[11px] transition-colors ${
          value === option.value
            ? "bg-background font-medium text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const SORT_LABELS: Record<BindingSort, string> = {
  valor_desc: "Maior valor primeiro",
  valor_asc: "Menor valor primeiro",
  label_asc: "Categoria (A→Z / cronológico)",
  label_desc: "Categoria (Z→A)",
};

type RecentResult = {
  id: string;
  title: string;
  sql: string;
  sourceId: string | null;
  columns: ResultColumn[];
  createdAt: string;
};

const useReadySources = () =>
  useDatasetsStore((state) => state.datasets).filter((s) => s.status === "pronta" && s.tables.length > 0);

/** Status da consulta do elemento + botão de atualizar. */
const BindingStatus = ({ elementId, binding }: { elementId: string; binding: DataBinding }) => {
  const live = useBindingData(elementId, binding);
  const { refresh } = useDashboardData();
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5">
      <span
        className={`min-w-0 truncate text-[10px] ${live.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
        title={live.status === "error" ? live.error : undefined}
      >
        {live.status === "loading"
          ? "Consultando…"
          : live.status === "error"
            ? live.error
            : live.status === "ready"
              ? `${live.data.rows.length} linha(s)${live.data.truncated ? " (limitado)" : ""} · ${live.data.durationMs} ms`
              : "Complete a configuração"}
      </span>
      <button
        type="button"
        onClick={refresh}
        title="Consultar novamente"
        aria-label="Consultar novamente"
        className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {live.status === "loading" ? (
          <Loader2 className="size-3 animate-spin" aria-hidden />
        ) : (
          <RefreshCw className="size-3" aria-hidden />
        )}
      </button>
    </div>
  );
};

const BuilderFields = ({
  type,
  binding,
  table,
  onChange,
}: {
  type: ElementType;
  binding: DataBinding;
  table: SourceTable | undefined;
  onChange: (patch: Partial<DataBinding>) => void;
}) => {
  const columns = table?.columns ?? [];
  const numeric = columns.filter((c) => c.kind === "numero");
  const isKpi = type === "kpi" || type === "percent" || type === "comparison";
  const isTable = type === "table";
  const grouped = Boolean(binding.dimension);
  const aggs: Aggregation[] = binding.measure ? ["sum", "avg", "min", "max", "count"] : ["count"];

  const measureFields = (
    <>
      <Field label="Medida">
        <Select
          value={binding.measure ?? ""}
          onChange={(value) =>
            onChange({ measure: value || undefined, agg: value ? (binding.agg === "count" ? "sum" : binding.agg ?? "sum") : "count" })
          }
        >
          <option value="">Contar linhas</option>
          {numeric.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      {binding.measure ? (
        <Field label="Cálculo">
          <Tabs
            value={binding.agg ?? "sum"}
            options={aggs.map((agg) => ({ value: agg, label: AGG_LABELS[agg] }))}
            onChange={(agg) => onChange({ agg })}
          />
        </Field>
      ) : null}
    </>
  );

  if (isKpi) return measureFields;

  if (isTable && !grouped) {
    const selected = binding.columns ?? [];
    return (
      <>
        <Field label="Exibir">
          <Tabs
            value="linhas"
            options={[
              { value: "linhas", label: "Linhas" },
              { value: "agrupado", label: "Agrupado" },
            ]}
            onChange={(mode) => {
              if (mode === "agrupado") {
                const dim = columns.find((c) => c.kind !== "numero")?.name ?? columns[0]?.name;
                onChange({ dimension: dim, measure: numeric[0]?.name, agg: numeric[0] ? "sum" : "count", sort: "valor_desc", columns: [] });
              }
            }}
          />
        </Field>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Colunas (nenhuma marcada = todas)</span>
          <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-border/70 p-1.5">
            {columns.map((c) => (
              <label key={c.name} className="flex items-center gap-2 text-[11px] text-foreground">
                <input
                  type="checkbox"
                  checked={selected.includes(c.name)}
                  onChange={(e) =>
                    onChange({
                      columns: e.target.checked ? [...selected, c.name] : selected.filter((n) => n !== c.name),
                    })
                  }
                />
                <span className="truncate font-mono">{c.name}</span>
              </label>
            ))}
          </div>
        </div>
        <LimitField binding={binding} onChange={onChange} />
      </>
    );
  }

  return (
    <>
      {isTable ? (
        <Field label="Exibir">
          <Tabs
            value="agrupado"
            options={[
              { value: "linhas", label: "Linhas" },
              { value: "agrupado", label: "Agrupado" },
            ]}
            onChange={(mode) => {
              if (mode === "linhas") onChange({ dimension: undefined, measure: undefined, agg: undefined });
            }}
          />
        </Field>
      ) : null}
      <Field label="Agrupar por (eixo X)">
        <Select value={binding.dimension ?? ""} onChange={(value) => onChange({ dimension: value || undefined })}>
          {columns.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({c.kind})
            </option>
          ))}
        </Select>
      </Field>
      {measureFields}
      <div className="grid grid-cols-[1fr_72px] gap-2">
        <Field label="Ordenar">
          <Select value={binding.sort ?? "valor_desc"} onChange={(value) => onChange({ sort: value as BindingSort })}>
            {(Object.keys(SORT_LABELS) as BindingSort[]).map((sort) => (
              <option key={sort} value={sort}>
                {SORT_LABELS[sort]}
              </option>
            ))}
          </Select>
        </Field>
        <LimitField binding={binding} onChange={onChange} compact />
      </div>
    </>
  );
};

const LimitField = ({
  binding,
  onChange,
  compact,
}: {
  binding: DataBinding;
  onChange: (patch: Partial<DataBinding>) => void;
  compact?: boolean;
}) => {
  const [text, setText] = useState(String(binding.limit ?? 50));
  useEffect(() => setText(String(binding.limit ?? 50)), [binding.limit]);
  return (
    <Field label={compact ? "Limite" : "Limite de linhas"}>
      <input
        className={`${inputCls} tabular-nums`}
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value.replace(/\D/g, ""))}
        onBlur={() => {
          const n = Math.min(Math.max(Number(text) || 50, 1), 500);
          setText(String(n));
          if (n !== binding.limit) onChange({ limit: n });
        }}
      />
    </Field>
  );
};

const SqlFields = ({
  elementId,
  binding,
  onChange,
  needsAxes,
}: {
  elementId: string;
  binding: DataBinding;
  onChange: (patch: Partial<DataBinding>) => void;
  needsAxes: boolean;
}) => {
  const [draft, setDraft] = useState(binding.sql ?? "");
  useEffect(() => setDraft(binding.sql ?? ""), [binding.sql]);
  const live = useBindingData(elementId, binding);
  const columns = live.status === "ready" ? live.data.columns : [];
  const axes = live.status === "ready" ? axesOf(binding, live.data) : null;

  return (
    <>
      <Field label="Consulta (somente leitura)" hint="Ctrl+Enter executa. Filtros do painel não se aplicam a SQL livre.">
        <textarea
          className={`${inputCls} min-h-28 resize-y font-mono text-[11px] leading-relaxed`}
          spellCheck={false}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== binding.sql && onChange({ sql: draft })}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") onChange({ sql: draft });
          }}
        />
      </Field>
      {needsAxes && columns.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Eixo X (categoria)">
            <Select value={axes?.x ?? ""} onChange={(x) => onChange({ x })}>
              {columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Valor (Y)">
            <Select value={axes?.y ?? ""} onChange={(y) => onChange({ y })}>
              {columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : null}
    </>
  );
};

/** Reaproveita uma consulta feita no chat (copia SQL e fonte). */
const RecentQueries = ({ onPick }: { onPick: (result: RecentResult) => void }) => {
  const [items, setItems] = useState<RecentResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<RecentResult[]>("/api/results")
      .then(setItems)
      .catch((err: Error) => setError(err.message));
  }, []);

  const usable = (items ?? []).filter((item) => item.sourceId);
  if (error) return <p className="text-[10px] text-destructive">{error}</p>;
  if (items && usable.length === 0) return null;

  return (
    <Field label="Usar consulta do chat">
      <div className="relative">
        <MessageSquareText
          className="pointer-events-none absolute start-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <select
          className={`${inputCls} cursor-pointer ps-7`}
          value=""
          onChange={(e) => {
            const picked = usable.find((item) => item.id === e.target.value);
            if (picked) onPick(picked);
          }}
        >
          <option value="">{items ? "Escolher…" : "Carregando…"}</option>
          {usable.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </div>
    </Field>
  );
};

/**
 * Configuração dos dados de um gráfico, tabela ou indicador.
 * `binding` ausente = elemento usa os dados de demonstração antigos.
 */
export const BindingEditor = ({
  elementId,
  type,
  binding,
  onChange,
}: {
  elementId: string;
  type: ElementType;
  binding: DataBinding | undefined;
  onChange: (binding: DataBinding | undefined) => void;
}) => {
  const sources = useReadySources();
  const source = sources.find((s) => s.id === binding?.sourceId);
  const table = source?.tables.find((t) => t.name === binding?.table);
  const patch = (next: Partial<DataBinding>) => binding && onChange({ ...binding, ...next });
  const needsAxes = type === "chart";

  const pickSource = (sourceId: string) => {
    if (!sourceId) return onChange(undefined);
    const next = sources.find((s) => s.id === sourceId);
    const first = next?.tables.find((t) => t.columns.some((c) => c.kind === "numero")) ?? next?.tables[0];
    if (next && first) onChange(builderFor(type, next.id, first));
  };

  return (
    <div className="flex flex-col gap-2.5">
      {sources.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-2 py-2 text-[11px] leading-snug text-muted-foreground">
          Nenhuma fonte pronta.{" "}
          <Link href="/fontes-de-dados" className="text-primary hover:underline">
            Conecte uma fonte
          </Link>{" "}
          para usar dados reais.
        </p>
      ) : null}

      <Field label="Fonte de dados">
        <Select value={binding?.sourceId ?? ""} onChange={pickSource}>
          <option value="">Demonstração (dados fictícios)</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>

      {binding ? (
        <>
          <Tabs
            value={binding.mode}
            options={[
              { value: "builder", label: "Construtor" },
              { value: "sql", label: "SQL" },
            ]}
            onChange={(mode) => {
              if (mode === binding.mode) return;
              if (mode === "sql" && !binding.sql && binding.table) {
                onChange({ ...binding, mode, sql: `SELECT *\nFROM ${binding.table}\nLIMIT 100` });
              } else {
                onChange({ ...binding, mode });
              }
            }}
          />

          {binding.mode === "builder" ? (
            <>
              <Field label="Tabela">
                <Select
                  value={binding.table ?? ""}
                  onChange={(name) => {
                    const next = source?.tables.find((t) => t.name === name);
                    if (next && source) onChange(builderFor(type, source.id, next));
                  }}
                >
                  {source?.tables.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                      {t.rowCount != null ? ` (${t.rowCount} linhas)` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <BuilderFields type={type} binding={binding} table={table} onChange={patch} />
            </>
          ) : (
            <SqlFields elementId={elementId} binding={binding} onChange={patch} needsAxes={needsAxes} />
          )}

          <RecentQueries
            onPick={(result) =>
              onChange({
                sourceId: result.sourceId as string,
                mode: "sql",
                sql: result.sql,
                x: result.columns.find((c) => c.kind !== "numero")?.name,
                y: result.columns.find((c) => c.kind === "numero")?.name,
              })
            }
          />

          {isBindingReady(binding) ? <BindingStatus elementId={elementId} binding={binding} /> : null}
        </>
      ) : null}
    </div>
  );
};

/** Ligação do elemento de filtro: fonte → tabela → coluna + valor padrão. */
export const FilterBindingEditor = ({
  binding,
  value,
  onChange,
}: {
  binding: FilterBinding | undefined;
  value: string;
  onChange: (patch: { binding?: FilterBinding; value?: string; label?: string }) => void;
}) => {
  const sources = useReadySources();
  const source = sources.find((s) => s.id === binding?.sourceId);
  const table = source?.tables.find((t) => t.name === binding?.table);
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    if (!binding?.column) return;
    let cancelled = false;
    api<{ options: string[] }>("/api/dashboards/filter-options", { method: "POST", json: { binding } })
      .then((out) => !cancelled && setOptions(out.options))
      .catch(() => !cancelled && setOptions([]));
    return () => {
      cancelled = true;
    };
  }, [binding]);

  const setSource = (sourceId: string) => {
    const next = sources.find((s) => s.id === sourceId);
    const t = next?.tables[0];
    const column = t?.columns.find((c) => c.kind === "texto") ?? t?.columns[0];
    if (next && t && column) {
      onChange({ binding: { sourceId: next.id, table: t.name, column: column.name }, value: "", label: column.name });
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <Field label="Fonte de dados">
        <Select value={binding?.sourceId ?? ""} onChange={setSource}>
          {!binding ? <option value="">Escolher…</option> : null}
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      {binding && source ? (
        <>
          <Field label="Tabela">
            <Select
              value={binding.table}
              onChange={(name) => {
                const t = source.tables.find((entry) => entry.name === name);
                const column = t?.columns.find((c) => c.kind === "texto") ?? t?.columns[0];
                if (t && column) onChange({ binding: { ...binding, table: t.name, column: column.name }, value: "" });
              }}
            >
              {source.tables.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Coluna filtrada">
            <Select
              value={binding.column}
              onChange={(column) => onChange({ binding: { ...binding, column }, value: "", label: column })}
            >
              {table?.columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.kind})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Valor inicial">
            <Select value={value} onChange={(next) => onChange({ value: next })}>
              <option value="">Todos</option>
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-[10px] leading-snug text-muted-foreground">
            Filtra os gráficos, tabelas e indicadores da tabela <span className="font-mono">{binding.table}</span>{" "}
            configurados no Construtor. Quem abre o link público também pode trocar o filtro.
          </p>
        </>
      ) : null}
    </div>
  );
};
