"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Rótulo + controle, no estilo dos formulários do editor. */
export const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
    {children}
    {hint ? <span className="text-[11px] text-muted-foreground/80">{hint}</span> : null}
  </label>
);

const controlClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

export const Select = <T extends string>({
  value,
  options,
  onChange,
  placeholder,
  disabled,
  ariaLabel,
}: {
  value: T | "";
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) => (
  <select
    value={value}
    disabled={disabled}
    aria-label={ariaLabel}
    onChange={(event) => onChange(event.target.value as T)}
    className={controlClass}
  >
    {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

/** Lista de caixas de seleção para escolher várias colunas ou valores. */
export const CheckList = ({
  options,
  selected,
  onChange,
  empty = "Nada para escolher.",
  maxHeight = "max-h-40",
}: {
  options: { value: string; label: string; hint?: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  empty?: string;
  maxHeight?: string;
}) => {
  if (options.length === 0) return <p className="text-xs text-muted-foreground">{empty}</p>;
  const all = options.length > 0 && selected.length === options.length;
  return (
    <div className="rounded-lg border border-input">
      <div className="flex items-center justify-between border-b border-input px-2 py-1 text-[11px] text-muted-foreground">
        <span>
          {selected.length} de {options.length} selecionada(s)
        </span>
        <button
          type="button"
          className="text-primary hover:underline"
          onClick={() => onChange(all ? [] : options.map((option) => option.value))}
        >
          {all ? "Limpar" : "Marcar todas"}
        </button>
      </div>
      <ul className={cn("overflow-y-auto py-1", maxHeight)}>
        {options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <li key={option.value}>
              <label className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange(checked ? selected.filter((value) => value !== option.value) : [...selected, option.value])
                  }
                  className="size-3.5 accent-primary"
                />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.hint ? <span className="text-[10px] text-muted-foreground">{option.hint}</span> : null}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
