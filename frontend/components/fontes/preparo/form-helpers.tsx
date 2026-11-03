"use client";

import { Input } from "@/components/ui/input";
import type { ColumnKind, ResultColumn } from "@/lib/domain/sources";
import { Select } from "./form-fields";

export const KIND_LABELS: Record<ColumnKind, string> = {
  numero: "número",
  texto: "texto",
  data: "data",
  booleano: "verdadeiro/falso",
  outro: "outro",
};

export const columnOptions = (columns: ResultColumn[]) =>
  columns.map((column) => ({ value: column.name, label: `${column.name} · ${KIND_LABELS[column.kind]}` }));

export const kindOf = (columns: ResultColumn[], name: string): ColumnKind =>
  columns.find((column) => column.name === name)?.kind ?? "texto";

export const columnsOfKind = (columns: ResultColumn[], ...kinds: ColumnKind[]) =>
  columns.filter((column) => kinds.includes(column.kind));

/** Texto digitado vira número ou verdadeiro/falso quando parece um; senão continua texto. */
export const parseTyped = (text: string): string | number | boolean => {
  if (/^-?\d+([.,]\d+)?$/.test(text.trim())) return Number(text.trim().replace(",", "."));
  const lower = text.trim().toLowerCase();
  if (lower === "true" || lower === "verdadeiro") return true;
  if (lower === "false" || lower === "falso") return false;
  return text;
};

/** Campo de valor que se adapta ao tipo da coluna (data, verdadeiro/falso, número ou texto). */
export const ValueInput = ({
  kind,
  value,
  onChange,
  placeholder = "Valor",
}: {
  kind: ColumnKind;
  value: string | number | boolean | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
}) =>
  kind === "booleano" ? (
    <Select
      value={String(value ?? "")}
      onChange={onChange}
      placeholder="Escolha"
      options={[
        { value: "true", label: "Verdadeiro" },
        { value: "false", label: "Falso" },
      ]}
    />
  ) : (
    <Input
      type={kind === "data" ? "date" : "text"}
      inputMode={kind === "numero" ? "decimal" : undefined}
      value={String(value ?? "")}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  );
