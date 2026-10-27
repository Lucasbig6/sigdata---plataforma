"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { clamp } from "@/lib/dashboards/types";

export const inputCls =
  "w-full rounded-md border border-border/70 bg-background px-2 py-1.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/50";

export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="flex flex-col gap-2.5 border-b border-border/50 px-3 py-3.5">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {title}
    </p>
    {children}
  </section>
);

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="flex min-w-0 flex-col gap-1">
    <span className="text-[11px] text-muted-foreground">{label}</span>
    {children}
  </label>
);

export const Grid2 = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-2 gap-2">{children}</div>
);

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
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
}

export const SwitchRow = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-xs text-foreground">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`absolute top-0.5 size-4 rounded-full bg-background shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  </div>
);

export const NumberField = ({
  value,
  min,
  max,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}) => {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const commit = () => {
    const parsed = Number(text.replace(",", "."));
    if (Number.isFinite(parsed)) {
      const next = clamp(parsed, min, max);
      setText(String(next));
      if (next !== value) onCommit(next);
    } else {
      setText(String(value));
    }
  };

  return (
    <input
      className={`${inputCls} tabular-nums`}
      inputMode="numeric"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setText(String(value));
          event.currentTarget.blur();
        }
      }}
    />
  );
};

const DARK_TEXT_COLORS = ["#E8ECEF", "#9FB0B4", "#80CEC4", "#F2D06B", "#FF8A7A"];
const LIGHT_TEXT_COLORS = ["#16202E", "#5A6B78", "#0F766E", "#B45309", "#D95F4B"];

export const ColorField = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const fallback = isDark ? "#E8ECEF" : "#16202E";
  const swatches = isDark ? DARK_TEXT_COLORS : LIGHT_TEXT_COLORS;
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        aria-label="Cor"
        value={hex}
        onChange={(event) => onChange(event.target.value)}
        className="size-7 cursor-pointer rounded-md border border-border/70 bg-transparent p-0.5"
      />
      {swatches.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Cor ${color}`}
          onClick={() => onChange(color)}
          className={`size-5 rounded-md border transition-transform hover:scale-110 ${
            value.toLowerCase() === color.toLowerCase()
              ? "border-primary ring-1 ring-primary/60"
              : "border-border/70"
          }`}
          style={{ background: color }}
        />
      ))}
    </div>
  );
};

export type SelectOption = { value: string; label: string; group?: string | null };

export const SelectField = ({
  value,
  options,
  onChange,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) => {
  const groupNames = [
    ...new Set(
      options.map((option) => option.group).filter((group): group is string => Boolean(group)),
    ),
  ];
  const grouped = groupNames.length > 0;

  return (
    <select
      className={`${inputCls} cursor-pointer`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options
        .filter((option) => !grouped || !option.group)
        .map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      {groupNames.map((group) => (
        <optgroup key={group} label={group}>
          {options
            .filter((option) => option.group === group)
            .map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
};

