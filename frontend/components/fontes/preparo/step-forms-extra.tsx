"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { DATE_PART_LABELS, type DatePart, type Step, type StepType } from "@/lib/domain/transform";
import { OP_CHOICES } from "@/lib/preparo/describe";
import { CheckList, Field, Select } from "./form-fields";
import { columnOptions, columnsOfKind, KIND_LABELS, kindOf, parseTyped, ValueInput } from "./form-helpers";
import type { FormContext } from "./step-forms";

type Of<T extends StepType> = Extract<Step, { type: T }>;

/** Tipos de etapa tratados aqui (os demais ficam em step-forms). */
export const EXTRA_TYPES: StepType[] = [
  "escolher",
  "limitar",
  "dividir",
  "substituir",
  "condicional",
  "indice",
  "calcular",
  "texto",
  "data_parte",
  "arredondar",
  "filtrar_valores",
  "acrescentar",
];

export const extraDefault = (type: StepType, ctx: FormContext): Step => {
  const id = crypto.randomUUID();
  const first = ctx.columns[0]?.name ?? "";
  const firstOf = (...kinds: Parameters<typeof columnsOfKind>[1][]) => columnsOfKind(ctx.columns, ...kinds)[0]?.name ?? first;
  switch (type) {
    case "escolher":
      return { id, type, columns: ctx.columns.map((column) => column.name) };
    case "limitar":
      return { id, type: "limitar", mode: "manter", n: 100 };
    case "dividir":
      return { id, type: "dividir", column: firstOf("texto"), delimiter: ",", parts: 2, removeOriginal: false };
    case "substituir":
      return { id, type: "substituir", column: firstOf("texto"), find: "", with: "" };
    case "condicional":
      return { id, type: "condicional", name: "Condição", column: first, op: "=", value: "", then: "sim", otherwise: "não" };
    case "indice":
      return { id, type: "indice", name: "Índice", start: 1 };
    case "calcular":
      return { id, type: "calcular", name: "Cálculo", left: firstOf("numero"), op: "+", right: { value: 1 } };
    case "texto":
      return { id, type: "texto", column: firstOf("texto"), fn: "maiusculas" };
    case "data_parte":
      return { id, type: "data_parte", column: firstOf("data"), part: "ano", name: "" };
    case "arredondar":
      return { id, type: "arredondar", column: firstOf("numero"), digits: 0 };
    case "filtrar_valores":
      return { id, type: "filtrar_valores", column: first, values: [], mode: "incluir" };
    case "acrescentar":
      return { id, type: "acrescentar", query: ctx.queries[0]?.id ?? "" };
    default:
      throw new Error(`Etapa sem formulário extra: ${type}`);
  }
};

export const extraProblem = (step: Step): string | null => {
  switch (step.type) {
    case "escolher":
      return step.columns.length === 0 ? "Marque ao menos uma coluna." : null;
    case "limitar":
      return !Number.isInteger(step.n) || step.n < 1 ? "Informe um número inteiro maior que zero." : null;
    case "dividir":
      return !step.column ? "Escolha a coluna." : !step.delimiter ? "Informe o separador." : null;
    case "substituir":
      return !step.column ? "Escolha a coluna." : !step.find ? "Informe o valor a procurar." : null;
    case "condicional":
      if (!step.name.trim()) return "Dê um nome à nova coluna.";
      if (step.op !== "nulo" && step.op !== "nao_nulo" && (step.value === undefined || step.value === "")) return "Informe o valor da condição.";
      return typeof step.then !== typeof step.otherwise ? "Os dois resultados devem ser do mesmo tipo (texto, número ou verdadeiro/falso)." : null;
    case "indice":
      return !step.name.trim() ? "Dê um nome à nova coluna." : null;
    case "calcular":
      if (!step.name.trim()) return "Dê um nome à nova coluna.";
      if (!step.left) return "Escolha a primeira coluna.";
      return "column" in step.right ? (step.right.column ? null : "Escolha a segunda coluna.") : Number.isFinite(step.right.value) ? null : "Informe um número.";
    case "texto":
    case "arredondar":
      return !step.column ? "Escolha a coluna." : null;
    case "data_parte":
      return !step.column ? "Escolha uma coluna de data." : null;
    case "filtrar_valores":
      return !step.column ? "Escolha a coluna." : step.values.length === 0 ? "Marque ao menos um valor." : null;
    case "acrescentar":
      return !step.query ? "Escolha a consulta." : null;
    default:
      return null;
  }
};

const NumberField = ({ value, onChange, min, max }: { value: number; onChange: (value: number) => void; min?: number; max?: number }) => (
  <Input type="number" value={Number.isFinite(value) ? value : ""} min={min} max={max} onChange={(event) => onChange(event.target.value === "" ? NaN : Number(event.target.value))} />
);

const NameField = ({ value, onChange, label = "Nome da nova coluna" }: { value: string; onChange: (value: string) => void; label?: string }) => (
  <Field label={label}>
    <Input value={value} maxLength={128} onChange={(event) => onChange(event.target.value)} />
  </Field>
);

const textColumnHint = "Só colunas de texto. Para outro tipo, mude o tipo antes.";

const ValuesFilterForm = ({ step, ctx, onChange }: { step: Of<"filtrar_valores">; ctx: FormContext; onChange: (step: Of<"filtrar_valores">) => void }) => {
  const [options, setOptions] = useState<{ values: string[]; truncated: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(step);
  latest.current = step;
  const { column } = step;
  const { fetchValues } = ctx;

  useEffect(() => {
    if (!column) return;
    let cancelled = false;
    setOptions(null);
    setError(null);
    fetchValues(column)
      .then((out) => {
        if (cancelled) return;
        setOptions(out);
        // valores já marcados que ainda existem continuam; sem marcação, começa com todos
        const kept = latest.current.values.filter((value) => out.values.includes(value));
        onChange({ ...latest.current, values: kept.length > 0 ? kept : out.values });
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
    // só quando a coluna muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [column, fetchValues]);

  return (
    <>
      <Field label="Coluna">
        <Select value={step.column} options={columnOptions(ctx.columns)} onChange={(next) => onChange({ ...step, column: next, values: [] })} />
      </Field>
      <Field label="O que fazer com os valores marcados">
        <Select
          value={step.mode}
          options={[
            { value: "incluir", label: "Manter só as linhas com estes valores" },
            { value: "excluir", label: "Remover as linhas com estes valores" },
          ]}
          onChange={(mode) => onChange({ ...step, mode })}
        />
      </Field>
      <Field label="Valores">
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
              maxHeight="max-h-56"
            />
            {options.truncated ? <p className="text-[11px] text-muted-foreground">Mostrando só os 50 primeiros valores distintos. Para outros, use “Filtrar linhas”.</p> : null}
          </>
        )}
      </Field>
    </>
  );
};

/** Formulários das etapas de "Escolher colunas" a "Acrescentar". */
export const ExtraStepForm = ({ step, ctx, onChange }: { step: Step; ctx: FormContext; onChange: (step: Step) => void }) => {
  switch (step.type) {
    case "escolher":
      return (
        <Field label="Colunas a manter" hint="As demais são removidas.">
          <CheckList
            options={ctx.columns.map((column) => ({ value: column.name, label: column.name, hint: KIND_LABELS[column.kind] }))}
            selected={step.columns}
            onChange={(columns) => onChange({ ...step, columns })}
            maxHeight="max-h-64"
          />
        </Field>
      );
    case "limitar":
      return (
        <>
          <Field label="Ação">
            <Select
              value={step.mode}
              options={[
                { value: "manter", label: "Manter as primeiras linhas" },
                { value: "remover", label: "Remover as primeiras linhas" },
              ]}
              onChange={(mode) => onChange({ ...step, mode })}
            />
          </Field>
          <Field label="Quantidade de linhas" hint="Segue a última ordenação aplicada.">
            <NumberField value={step.n} min={1} max={1_000_000} onChange={(n) => onChange({ ...step, n })} />
          </Field>
        </>
      );
    case "dividir":
      return (
        <>
          <Field label="Coluna" hint={textColumnHint}>
            <Select value={step.column} options={columnOptions(columnsOfKind(ctx.columns, "texto"))} onChange={(column) => onChange({ ...step, column })} />
          </Field>
          <Field label="Separador" hint="Por exemplo: vírgula, ponto e vírgula, hífen ou espaço.">
            <Input value={step.delimiter} maxLength={20} onChange={(event) => onChange({ ...step, delimiter: event.target.value })} />
          </Field>
          <Field label="Número de partes">
            <NumberField value={step.parts} min={2} max={10} onChange={(parts) => onChange({ ...step, parts })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-3.5 accent-primary" checked={step.removeOriginal} onChange={(event) => onChange({ ...step, removeOriginal: event.target.checked })} />
            Remover a coluna original
          </label>
        </>
      );
    case "substituir":
      return (
        <>
          <Field label="Coluna" hint={textColumnHint}>
            <Select value={step.column} options={columnOptions(columnsOfKind(ctx.columns, "texto"))} onChange={(column) => onChange({ ...step, column })} />
          </Field>
          <Field label="Valor a procurar">
            <Input value={step.find} maxLength={1000} onChange={(event) => onChange({ ...step, find: event.target.value })} />
          </Field>
          <Field label="Substituir por" hint="Deixe vazio para apagar o trecho.">
            <Input value={step.with} maxLength={1000} onChange={(event) => onChange({ ...step, with: event.target.value })} />
          </Field>
        </>
      );
    case "condicional": {
      const kind = kindOf(ctx.columns, step.column);
      const noValue = step.op === "nulo" || step.op === "nao_nulo";
      return (
        <>
          <NameField value={step.name} onChange={(name) => onChange({ ...step, name })} />
          <Field label="Se a coluna">
            <Select value={step.column} options={columnOptions(ctx.columns)} onChange={(column) => onChange({ ...step, column, value: "" })} />
          </Field>
          <Field label="Condição">
            <Select value={step.op} options={OP_CHOICES.map(([value, label]) => ({ value, label }))} onChange={(op) => onChange({ ...step, op })} />
          </Field>
          {noValue ? null : (
            <Field label="Valor">
              <ValueInput kind={step.op === "contem" ? "texto" : kind} value={step.value} onChange={(value) => onChange({ ...step, value })} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Então">
              <Input value={String(step.then)} onChange={(event) => onChange({ ...step, then: parseTyped(event.target.value) })} />
            </Field>
            <Field label="Senão">
              <Input value={String(step.otherwise)} onChange={(event) => onChange({ ...step, otherwise: parseTyped(event.target.value) })} />
            </Field>
          </div>
          <p className="text-[11px] text-muted-foreground">Números e verdadeiro/falso são reconhecidos; o resto vira texto. Os dois resultados devem ter o mesmo tipo.</p>
        </>
      );
    }
    case "indice":
      return (
        <>
          <NameField value={step.name} onChange={(name) => onChange({ ...step, name })} />
          <Field label="Começar em" hint="Numera as linhas na ordem atual.">
            <Select
              value={String(step.start) as "0" | "1"}
              options={[
                { value: "1", label: "1" },
                { value: "0", label: "0" },
              ]}
              onChange={(start) => onChange({ ...step, start: Number(start) as 0 | 1 })}
            />
          </Field>
        </>
      );
    case "calcular": {
      const numeric = columnOptions(columnsOfKind(ctx.columns, "numero"));
      const rightIsColumn = "column" in step.right;
      return (
        <>
          <NameField value={step.name} onChange={(name) => onChange({ ...step, name })} />
          <Field label="Primeira coluna (numérica)">
            <Select value={step.left} options={numeric} onChange={(left) => onChange({ ...step, left })} />
          </Field>
          <Field label="Operação">
            <Select
              value={step.op}
              options={[
                { value: "+", label: "+ soma" },
                { value: "-", label: "− subtração" },
                { value: "*", label: "× multiplicação" },
                { value: "/", label: "÷ divisão (por zero vira nulo)" },
              ]}
              onChange={(op) => onChange({ ...step, op })}
            />
          </Field>
          <Field label="Segundo termo">
            <Select
              value={rightIsColumn ? "coluna" : "numero"}
              options={[
                { value: "numero", label: "Um número fixo" },
                { value: "coluna", label: "Outra coluna" },
              ]}
              onChange={(mode) => onChange({ ...step, right: mode === "coluna" ? { column: numeric[0]?.value ?? "" } : { value: 1 } })}
            />
          </Field>
          {"column" in step.right ? (
            <Select ariaLabel="Segunda coluna" value={step.right.column} options={numeric} onChange={(column) => onChange({ ...step, right: { column } })} />
          ) : (
            <NumberField value={step.right.value} onChange={(value) => onChange({ ...step, right: { value } })} />
          )}
        </>
      );
    }
    case "texto":
      return (
        <>
          <Field label="Coluna" hint={textColumnHint}>
            <Select value={step.column} options={columnOptions(columnsOfKind(ctx.columns, "texto"))} onChange={(column) => onChange({ ...step, column })} />
          </Field>
          <Field label="Formatação">
            <Select
              value={step.fn}
              options={[
                { value: "maiusculas", label: "MAIÚSCULAS" },
                { value: "minusculas", label: "minúsculas" },
                { value: "aparar", label: "Aparar espaços do início e do fim" },
              ]}
              onChange={(fn) => onChange({ ...step, fn })}
            />
          </Field>
        </>
      );
    case "data_parte":
      return (
        <>
          <Field label="Coluna de data">
            <Select value={step.column} options={columnOptions(columnsOfKind(ctx.columns, "data"))} onChange={(column) => onChange({ ...step, column })} />
          </Field>
          <Field label="Parte">
            <Select
              value={step.part}
              options={(Object.keys(DATE_PART_LABELS) as DatePart[]).map((part) => ({ value: part, label: DATE_PART_LABELS[part] }))}
              onChange={(part) => onChange({ ...step, part })}
            />
          </Field>
          <NameField label="Nome da nova coluna (opcional)" value={step.name} onChange={(name) => onChange({ ...step, name })} />
        </>
      );
    case "arredondar":
      return (
        <>
          <Field label="Coluna (numérica)">
            <Select value={step.column} options={columnOptions(columnsOfKind(ctx.columns, "numero"))} onChange={(column) => onChange({ ...step, column })} />
          </Field>
          <Field label="Casas decimais">
            <NumberField value={step.digits} min={0} max={10} onChange={(digits) => onChange({ ...step, digits })} />
          </Field>
        </>
      );
    case "filtrar_valores":
      return <ValuesFilterForm step={step} ctx={ctx} onChange={onChange} />;
    case "acrescentar":
      return (
        <Field label="Consulta a acrescentar" hint="As linhas dela entram no fim; as colunas são casadas pelo nome e as que faltam ficam nulas. A origem de cada consulta só é lida.">
          <Select
            value={step.query}
            placeholder={ctx.queries.length === 0 ? "Abra outra consulta primeiro" : "Escolha a consulta"}
            options={ctx.queries.map((query) => ({ value: query.id, label: query.name }))}
            onChange={(query) => onChange({ ...step, query })}
          />
        </Field>
      );
    default:
      return null;
  }
};
