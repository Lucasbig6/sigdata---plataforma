"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ColumnKind, ResultColumn, SourceTable } from "@/lib/domain/sources";
import {
  AGG_LABELS,
  JOIN_LABELS,
  type AggFn,
  type Aggregation,
  type JoinKind,
  type Step,
  type StepType,
  type TargetType,
} from "@/lib/domain/transform";
import { OP_CHOICES } from "@/lib/preparo/describe";
import { CheckList, Field, Select } from "./form-fields";
import { columnOptions, KIND_LABELS, kindOf, ValueInput } from "./form-helpers";
import { ExtraStepForm, extraDefault, extraProblem } from "./step-forms-extra";

export type FormContext = {
  /** Colunas do resultado antes desta etapa. */
  columns: ResultColumn[];
  /** Tabelas da fonte (para mesclar). */
  tables: SourceTable[];
  currentTable: string;
  /** Outras consultas abertas, para mesclar e acrescentar. */
  queries: { id: string; name: string }[];
  /** Colunas do resultado de outra consulta. */
  fetchQueryColumns: (id: string) => Promise<ResultColumn[]>;
  fetchValues: (column: string) => Promise<{ values: string[]; truncated: boolean }>;
};

type Of<T extends StepType> = Extract<Step, { type: T }>;

const TYPE_CHOICES: { value: TargetType; label: string }[] = [
  { value: "texto", label: "Texto" },
  { value: "numero", label: "Número" },
  { value: "data", label: "Data" },
  { value: "booleano", label: "Verdadeiro/falso" },
];

export const STEP_TYPE_GROUPS: { label: string; types: StepType[] }[] = [
  { label: "Linhas", types: ["filtrar", "filtrar_valores", "limitar", "remover_nulos", "duplicadas", "preencher", "ordenar"] },
  { label: "Colunas", types: ["escolher", "renomear", "remover", "tipo", "dividir", "substituir", "texto", "arredondar"] },
  { label: "Adicionar coluna", types: ["condicional", "indice", "calcular", "data_parte"] },
  { label: "Combinar e resumir", types: ["agrupar", "mesclar", "acrescentar", "dinamizar"] },
];

const autoName = (fn: AggFn, column: string | null) =>
  column ? `${AGG_LABELS[fn]} de ${column}` : "Linhas";

const keysOf = (tables: SourceTable[], name: string) => tables.find((table) => table.name === name)?.columns ?? [];

/** Etapa nova com valores iniciais sensatos para as colunas disponíveis. */
export const defaultStep = (type: StepType, ctx: FormContext): Step => {
  const id = crypto.randomUUID();
  const first = ctx.columns[0]?.name ?? "";
  const numeric = ctx.columns.find((column) => column.kind === "numero")?.name ?? first;
  switch (type) {
    case "filtrar":
      return { id, type, column: first, op: "=", value: "" };
    case "renomear":
      return { id, type, from: first, to: "" };
    case "remover":
      return { id, type, columns: [] };
    case "tipo":
      return { id, type, column: first, to: "texto" };
    case "ordenar":
      return { id, type, column: first, dir: "asc" };
    case "remover_nulos":
      return { id, type, columns: [] };
    case "duplicadas":
      return { id, type, columns: [] };
    case "preencher":
      return { id, type, column: first, value: "" };
    case "agrupar":
      return { id, type, by: [], aggregations: [{ column: null, fn: "contagem", as: "Linhas" }] };
    case "mesclar": {
      const other = ctx.tables.find((table) => table.name !== ctx.currentTable) ?? ctx.tables[0];
      const right = other?.columns ?? [];
      const rightKey = right.find((column) => column.name === first)?.name ?? right[0]?.name ?? "";
      return {
        id,
        type,
        table: other?.name ?? "",
        kind: "esquerda",
        on: [{ left: first, right: rightKey }],
        columns: right.filter((column) => column.name !== rightKey).map((column) => column.name),
      };
    }
    case "dinamizar":
      return { id, type, column: first, values: [], value: numeric, fn: "soma", by: [] };
    default:
      return extraDefault(type, ctx);
  }
};

/** Mensagem do que falta preencher; `null` quando a etapa pode ser aplicada. */
export const stepProblem = (step: Step): string | null => {
  switch (step.type) {
    case "filtrar":
      if (!step.column) return "Escolha a coluna.";
      if (step.op !== "nulo" && step.op !== "nao_nulo" && (step.value === undefined || step.value === "")) {
        return "Informe o valor do filtro.";
      }
      return null;
    case "renomear":
      return !step.from ? "Escolha a coluna." : !step.to.trim() ? "Informe o novo nome." : null;
    case "remover":
    case "remover_nulos":
      return step.columns.length === 0 ? "Marque ao menos uma coluna." : null;
    case "tipo":
    case "ordenar":
      return !step.column ? "Escolha a coluna." : null;
    case "duplicadas":
      return null;
    case "preencher":
      return !step.column ? "Escolha a coluna." : step.value === "" ? "Informe o valor de preenchimento." : null;
    case "agrupar":
      if (step.by.length === 0 && step.aggregations.length === 0) return "Escolha colunas para agrupar ou um resumo.";
      return step.aggregations.some((aggregation) => !aggregation.as.trim() || (aggregation.fn !== "contagem" && !aggregation.column))
        ? "Cada resumo precisa de nome e de uma coluna."
        : null;
    case "mesclar":
      if (!step.table && !step.query) return "Escolha a outra tabela ou consulta.";
      return step.on.length === 0 || step.on.some((pair) => !pair.left || !pair.right) ? "Escolha as colunas que casam as tabelas." : null;
    case "dinamizar":
      if (!step.column || !step.value) return "Escolha a coluna e os valores.";
      if (step.column === step.value) return "A coluna dinamizada e a de valores devem ser diferentes.";
      return step.values.length === 0 ? "Marque ao menos um valor para virar coluna." : null;
    default:
      return extraProblem(step);
  }
};

const FilterForm = ({ step, ctx, onChange }: { step: Of<"filtrar">; ctx: FormContext; onChange: (step: Of<"filtrar">) => void }) => {
  const kind = kindOf(ctx.columns, step.column);
  const noValue = step.op === "nulo" || step.op === "nao_nulo";
  return (
    <>
      <Field label="Coluna">
        <Select value={step.column} options={columnOptions(ctx.columns)} onChange={(column) => onChange({ ...step, column, value: "" })} />
      </Field>
      <Field label="Condição">
        <Select
          value={step.op}
          options={OP_CHOICES.map(([value, label]) => ({ value, label }))}
          onChange={(op) => onChange({ ...step, op })}
        />
      </Field>
      {noValue ? null : (
        <Field label="Valor">
          <ValueInput
            kind={step.op === "contem" ? "texto" : kind}
            value={step.value}
            onChange={(value) => onChange({ ...step, value })}
          />
        </Field>
      )}
    </>
  );
};

const RenameForm = ({ step, ctx, onChange }: { step: Of<"renomear">; ctx: FormContext; onChange: (step: Of<"renomear">) => void }) => (
  <>
    <Field label="Coluna">
      <Select value={step.from} options={columnOptions(ctx.columns)} onChange={(from) => onChange({ ...step, from })} />
    </Field>
    <Field label="Novo nome">
      <Input value={step.to} maxLength={128} onChange={(event) => onChange({ ...step, to: event.target.value })} autoFocus />
    </Field>
  </>
);

const ColumnsForm = ({
  step,
  ctx,
  onChange,
  hint,
}: {
  step: Of<"remover"> | Of<"remover_nulos"> | Of<"duplicadas">;
  ctx: FormContext;
  onChange: (step: Step) => void;
  hint?: string;
}) => (
  <Field label="Colunas" hint={hint}>
    <CheckList
      options={ctx.columns.map((column) => ({ value: column.name, label: column.name, hint: KIND_LABELS[column.kind] }))}
      selected={step.columns}
      onChange={(columns) => onChange({ ...step, columns })}
    />
  </Field>
);

const TypeForm = ({ step, ctx, onChange }: { step: Of<"tipo">; ctx: FormContext; onChange: (step: Of<"tipo">) => void }) => (
  <>
    <Field label="Coluna">
      <Select value={step.column} options={columnOptions(ctx.columns)} onChange={(column) => onChange({ ...step, column })} />
    </Field>
    <Field label="Novo tipo" hint="O que não puder ser convertido vira nulo (em bancos PostgreSQL, a conversão falha e avisa o motivo).">
      <Select value={step.to} options={TYPE_CHOICES} onChange={(to) => onChange({ ...step, to })} />
    </Field>
  </>
);

const SortForm = ({ step, ctx, onChange }: { step: Of<"ordenar">; ctx: FormContext; onChange: (step: Of<"ordenar">) => void }) => (
  <>
    <Field label="Coluna">
      <Select value={step.column} options={columnOptions(ctx.columns)} onChange={(column) => onChange({ ...step, column })} />
    </Field>
    <Field label="Ordem" hint="Vale para o resultado final; a última ordenação é a que fica.">
      <Select
        value={step.dir}
        options={[
          { value: "asc", label: "Crescente (A→Z, menor→maior)" },
          { value: "desc", label: "Decrescente (Z→A, maior→menor)" },
        ]}
        onChange={(dir) => onChange({ ...step, dir })}
      />
    </Field>
  </>
);

const FillForm = ({ step, ctx, onChange }: { step: Of<"preencher">; ctx: FormContext; onChange: (step: Of<"preencher">) => void }) => (
  <>
    <Field label="Coluna">
      <Select value={step.column} options={columnOptions(ctx.columns)} onChange={(column) => onChange({ ...step, column, value: "" })} />
    </Field>
    <Field label="Trocar valores nulos por">
      <ValueInput kind={kindOf(ctx.columns, step.column)} value={step.value} onChange={(value) => onChange({ ...step, value })} />
    </Field>
  </>
);

const aggregableColumns = (columns: ResultColumn[], fn: AggFn) => {
  if (fn === "soma" || fn === "media") return columns.filter((column) => column.kind === "numero");
  if (fn === "minimo" || fn === "maximo") return columns.filter((column) => column.kind !== "booleano" && column.kind !== "outro");
  return columns;
};

const GroupForm = ({ step, ctx, onChange }: { step: Of<"agrupar">; ctx: FormContext; onChange: (step: Of<"agrupar">) => void }) => {
  const update = (index: number, patch: Partial<Aggregation>) =>
    onChange({
      ...step,
      aggregations: step.aggregations.map((aggregation, i) => {
        if (i !== index) return aggregation;
        const next = { ...aggregation, ...patch };
        // o nome acompanha a escolha enquanto a pessoa não o editar
        const wasAuto = aggregation.as === autoName(aggregation.fn, aggregation.column);
        if (wasAuto && patch.as === undefined) next.as = autoName(next.fn, next.column);
        return next;
      }),
    });

  return (
    <>
      <Field label="Agrupar por" hint="Uma linha para cada combinação. Sem nenhuma coluna, o resultado é uma linha só.">
        <CheckList
          options={ctx.columns.map((column) => ({ value: column.name, label: column.name, hint: KIND_LABELS[column.kind] }))}
          selected={step.by}
          onChange={(by) => onChange({ ...step, by })}
          maxHeight="max-h-32"
        />
      </Field>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Resumos</span>
        {step.aggregations.map((aggregation, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr] gap-1.5 rounded-lg border border-input p-2">
            <Select
              ariaLabel="Operação"
              value={aggregation.fn}
              options={(Object.keys(AGG_LABELS) as AggFn[]).map((fn) => ({ value: fn, label: AGG_LABELS[fn] }))}
              onChange={(fn) => {
                const allowed = aggregableColumns(ctx.columns, fn).some((column) => column.name === aggregation.column);
                update(index, { fn, column: fn === "contagem" ? aggregation.column : allowed ? aggregation.column : null });
              }}
            />
            <Select
              ariaLabel="Coluna do resumo"
              value={aggregation.column ?? ""}
              placeholder={aggregation.fn === "contagem" ? "Todas as linhas" : "Escolha a coluna"}
              options={columnOptions(aggregableColumns(ctx.columns, aggregation.fn))}
              onChange={(column) => update(index, { column: column || null })}
            />
            <Input
              aria-label="Nome da coluna resultante"
              value={aggregation.as}
              maxLength={128}
              onChange={(event) => update(index, { as: event.target.value })}
              placeholder="Nome da coluna"
            />
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="justify-self-end text-muted-foreground"
              onClick={() => onChange({ ...step, aggregations: step.aggregations.filter((_, i) => i !== index) })}
            >
              <Trash2 aria-hidden />
              Remover
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          type="button"
          className="w-fit"
          onClick={() => {
            // nome que ainda não existe na lista, para não repetir "Linhas"
            const taken = new Set(step.aggregations.map((aggregation) => aggregation.as.toLowerCase()));
            let name = autoName("contagem", null);
            for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${autoName("contagem", null)} ${n}`;
            onChange({ ...step, aggregations: [...step.aggregations, { column: null, fn: "contagem", as: name }] });
          }}
        >
          <Plus aria-hidden />
          Adicionar resumo
        </Button>
      </div>
    </>
  );
};

const MergeForm = ({ step, ctx, onChange }: { step: Of<"mesclar">; ctx: FormContext; onChange: (step: Of<"mesclar">) => void }) => {
  const [queryColumns, setQueryColumns] = useState<ResultColumn[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { fetchQueryColumns } = ctx;
  const queryId = step.query;

  useEffect(() => {
    if (!queryId) return;
    let cancelled = false;
    setQueryColumns(null);
    setLoadError(null);
    fetchQueryColumns(queryId)
      .then((columns) => !cancelled && setQueryColumns(columns))
      .catch((error: Error) => !cancelled && setLoadError(error.message));
    return () => {
      cancelled = true;
    };
  }, [queryId, fetchQueryColumns]);

  const right: { name: string; kind: ColumnKind }[] = queryId ? (queryColumns ?? []) : keysOf(ctx.tables, step.table);
  const keyNames = step.on.map((pair) => pair.right);

  const reset = (columns: { name: string; kind: ColumnKind }[], patch: { table: string; query?: string | undefined }) => {
    const rightKey = columns.find((column) => column.name === step.on[0]?.left)?.name ?? columns[0]?.name ?? "";
    onChange({
      ...step,
      ...patch,
      on: [{ left: step.on[0]?.left ?? ctx.columns[0]?.name ?? "", right: rightKey }],
      columns: columns.filter((column) => column.name !== rightKey).map((column) => column.name),
    });
  };
  const pickRight = (value: string) => {
    if (value.startsWith("t:")) {
      const table = value.slice(2);
      setQueryColumns(null);
      reset(keysOf(ctx.tables, table), { table, query: undefined });
    } else {
      onChange({ ...step, table: "", query: value.slice(2), on: [{ left: step.on[0]?.left ?? ctx.columns[0]?.name ?? "", right: "" }], columns: [] });
    }
  };

  // ao escolher uma consulta, as colunas chegam depois: monta as chaves quando elas aparecem
  useEffect(() => {
    if (!queryId || !queryColumns || step.on[0]?.right) return;
    reset(queryColumns, { table: "", query: queryId });
    // só quando as colunas da consulta acabam de chegar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryColumns]);

  const setPair = (index: number, patch: Partial<{ left: string; right: string }>) =>
    onChange({ ...step, on: step.on.map((pair, i) => (i === index ? { ...pair, ...patch } : pair)) });

  const current = queryId ? `q:${queryId}` : `t:${step.table}`;

  return (
    <>
      <Field label="Mesclar com" hint="Uma tabela desta fonte ou outra consulta (inclusive de outra fonte). As origens só são lidas: a junção acontece numa cópia, em memória.">
        <select
          value={current}
          onChange={(event) => pickRight(event.target.value)}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <optgroup label="Tabelas desta fonte">
            {ctx.tables.map((table) => (
              <option key={table.name} value={`t:${table.name}`}>
                {table.name}
              </option>
            ))}
          </optgroup>
          {ctx.queries.length > 0 ? (
            <optgroup label="Outras consultas">
              {ctx.queries.map((query) => (
                <option key={query.id} value={`q:${query.id}`}>
                  {query.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </Field>
      {loadError ? <p className="text-xs text-destructive">{loadError}</p> : null}
      {queryId && queryColumns === null && !loadError ? <p className="text-xs text-muted-foreground">Carregando colunas da consulta…</p> : null}
      <Field label="Tipo de junção">
        <Select
          value={step.kind}
          options={(Object.keys(JOIN_LABELS) as JoinKind[]).map((kind) => ({ value: kind, label: JOIN_LABELS[kind] }))}
          onChange={(kind) => onChange({ ...step, kind })}
        />
      </Field>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Colunas que casam</span>
        {step.on.map((pair, index) => (
          <div key={index} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-1.5">
            <Select ariaLabel="Coluna daqui" value={pair.left} options={columnOptions(ctx.columns)} onChange={(left) => setPair(index, { left })} />
            <span className="text-muted-foreground">=</span>
            <Select
              ariaLabel="Coluna da outra tabela"
              value={pair.right}
              options={right.map((column) => ({ value: column.name, label: `${column.name} · ${KIND_LABELS[column.kind]}` }))}
              onChange={(value) => setPair(index, { right: value })}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              aria-label="Remover par"
              disabled={step.on.length === 1}
              onClick={() => onChange({ ...step, on: step.on.filter((_, i) => i !== index) })}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          type="button"
          className="w-fit"
          onClick={() => onChange({ ...step, on: [...step.on, { left: ctx.columns[0]?.name ?? "", right: right[0]?.name ?? "" }] })}
        >
          <Plus aria-hidden />
          Adicionar par
        </Button>
      </div>
      <Field label="Colunas a trazer" hint="Colunas com o mesmo nome ganham o nome da outra tabela entre parênteses.">
        <CheckList
          options={right
            .filter((column) => !keyNames.includes(column.name))
            .map((column) => ({ value: column.name, label: column.name, hint: KIND_LABELS[column.kind] }))}
          selected={step.columns}
          onChange={(columns) => onChange({ ...step, columns })}
        />
      </Field>
    </>
  );
};

const PivotForm = ({ step, ctx, onChange }: { step: Of<"dinamizar">; ctx: FormContext; onChange: (step: Of<"dinamizar">) => void }) => {
  const [options, setOptions] = useState<{ values: string[]; truncated: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { column } = step;
  const { fetchValues } = ctx;
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    if (!column) return;
    let cancelled = false;
    setOptions(null);
    setError(null);
    fetchValues(column)
      .then((out) => {
        if (cancelled) return;
        setOptions(out);
        // valores já escolhidos que ainda existem continuam marcados; sem escolha, marca todos
        const kept = stepRef.current.values.filter((value) => out.values.includes(value));
        onChange({ ...stepRef.current, values: kept.length > 0 ? kept : out.values });
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
    // só quando a coluna dinamizada muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [column, fetchValues]);

  const others = ctx.columns.filter((entry) => entry.name !== step.column && entry.name !== step.value);

  return (
    <>
      <Field label="Coluna cujos valores viram colunas">
        <Select value={step.column} options={columnOptions(ctx.columns)} onChange={(next) => onChange({ ...step, column: next, values: [] })} />
      </Field>
      <Field label="Valores a colocar nas células">
        <Select value={step.value} options={columnOptions(ctx.columns)} onChange={(value) => onChange({ ...step, value })} />
      </Field>
      <Field label="Operação">
        <Select
          value={step.fn}
          options={(Object.keys(AGG_LABELS) as AggFn[]).map((fn) => ({ value: fn, label: AGG_LABELS[fn] }))}
          onChange={(fn) => onChange({ ...step, fn })}
        />
      </Field>
      <Field label="Colunas que continuam como linhas" hint="Podem ficar vazias.">
        <CheckList
          options={others.map((entry) => ({ value: entry.name, label: entry.name, hint: KIND_LABELS[entry.kind] }))}
          selected={step.by}
          onChange={(by) => onChange({ ...step, by })}
          maxHeight="max-h-28"
        />
      </Field>
      <Field label="Valores que viram colunas">
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : options === null ? (
          <p className="text-xs text-muted-foreground">Carregando valores…</p>
        ) : (
          <>
            <CheckList
              options={options.values.map((value) => ({ value, label: value }))}
              selected={step.values}
              onChange={(values) => onChange({ ...step, values })}
              empty="A coluna não tem valores."
            />
            {options.truncated ? (
              <p className="text-[11px] text-muted-foreground">Mostrando os 50 primeiros valores distintos.</p>
            ) : null}
          </>
        )}
      </Field>
    </>
  );
};

/** Formulário da etapa conforme o tipo. */
export const StepForm = ({ step, ctx, onChange }: { step: Step; ctx: FormContext; onChange: (step: Step) => void }) => {
  switch (step.type) {
    case "filtrar":
      return <FilterForm step={step} ctx={ctx} onChange={onChange} />;
    case "renomear":
      return <RenameForm step={step} ctx={ctx} onChange={onChange} />;
    case "remover":
      return <ColumnsForm step={step} ctx={ctx} onChange={onChange} />;
    case "remover_nulos":
      return <ColumnsForm step={step} ctx={ctx} onChange={onChange} hint="Some a linha se qualquer uma das colunas marcadas estiver nula." />;
    case "duplicadas":
      return (
        <ColumnsForm
          step={step}
          ctx={ctx}
          onChange={onChange}
          hint="Duas linhas são duplicadas se tiverem os mesmos valores nas colunas marcadas. Sem nenhuma marcada, vale a linha inteira."
        />
      );
    case "tipo":
      return <TypeForm step={step} ctx={ctx} onChange={onChange} />;
    case "ordenar":
      return <SortForm step={step} ctx={ctx} onChange={onChange} />;
    case "preencher":
      return <FillForm step={step} ctx={ctx} onChange={onChange} />;
    case "agrupar":
      return <GroupForm step={step} ctx={ctx} onChange={onChange} />;
    case "mesclar":
      return <MergeForm step={step} ctx={ctx} onChange={onChange} />;
    case "dinamizar":
      return <PivotForm step={step} ctx={ctx} onChange={onChange} />;
    default:
      return <ExtraStepForm step={step} ctx={ctx} onChange={onChange} />;
  }
};
