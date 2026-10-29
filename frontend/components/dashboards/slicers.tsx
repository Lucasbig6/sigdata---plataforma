"use client";

import { Popover } from "@base-ui/react/popover";
import { CalendarDays, Check, ChevronDown, Eraser, Search } from "lucide-react";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { frameCss } from "@/lib/dashboards/frame";
import { filterValueOf, useDashboardData, useFilterOptions } from "@/lib/dashboards/live-data";
import { useDashboardsStore } from "@/lib/dashboards/store";
import type { DashboardElement } from "@/lib/dashboards/types";
import { FILTER_MULTI_MAX, joinMulti, splitMulti } from "@shared/dashboards/data";
import { cn } from "@/lib/utils";

/**
 * Segmentações (filtros) no estilo do Power BI: título com borracha, lista suspensa,
 * lista com caixas de seleção, blocos e filtro de período com controle deslizante.
 * No editor os controles ficam inertes (o elemento inteiro arrasta); em Visualizar e
 * no link público funcionam.
 */

type FilterElement = DashboardElement & { type: "filter" };

const FILTER_PADDING = 10;

const useStyle = (element: FilterElement) => {
  const p = element.props;
  return {
    fontSize: p.fontSize ?? 12,
    accent: p.accent || "var(--primary)",
    color: p.textColor || undefined,
    showTitle: p.showTitle !== false,
    showClear: p.showClear !== false,
  };
};

/** Moldura + título + borracha. `inert` no editor. */
const Shell = ({
  element,
  hasValue,
  onClear,
  children,
}: {
  element: FilterElement;
  hasValue: boolean;
  onClear: () => void;
  children: ReactNode;
}) => {
  const editing = !useDashboardsStore((state) => state.preview);
  const s = useStyle(element);
  const style: CSSProperties = { ...frameCss(element.props.frame, FILTER_PADDING), color: s.color, fontSize: s.fontSize };
  return (
    <div className={cn("flex h-full w-full flex-col gap-2 overflow-hidden", editing && "pointer-events-none")} style={style}>
      {s.showTitle || (s.showClear && hasValue) ? (
        <header className="flex shrink-0 items-center gap-2">
          {s.showTitle ? <p className="min-w-0 flex-1 truncate font-semibold">{element.props.label}</p> : <span className="flex-1" />}
          {s.showClear && hasValue ? (
            <button
              type="button"
              onClick={onClear}
              aria-label="Limpar seleção"
              title="Limpar seleção"
              className="grid size-5 shrink-0 place-items-center rounded opacity-70 transition-opacity hover:opacity-100"
            >
              <Eraser className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </header>
      ) : null}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
};

/* ----------------------------------------------------------------- lista */

const Box = ({ checked, round, accent }: { checked: boolean; round?: boolean; accent: string }) => (
  <span
    aria-hidden
    className={cn("grid size-3.5 shrink-0 place-items-center border transition-colors", round ? "rounded-full" : "rounded-[3px]")}
    style={checked ? { background: accent, borderColor: accent } : { borderColor: "color-mix(in oklch, currentColor 45%, transparent)" }}
  >
    {checked ? (
      round ? <span className="size-1.5 rounded-full bg-white" /> : <Check className="size-2.5 text-white" strokeWidth={3.5} />
    ) : null}
  </span>
);

type OptionsProps = {
  options: string[];
  selected: string[];
  multi: boolean;
  search: boolean;
  selectAll: boolean;
  allowAll: boolean;
  accent: string;
  fontSize: number;
  onToggle: (option: string) => void;
  onClear: () => void;
};

/** Lista com busca, "Selecionar tudo" e caixas de seleção (também é o conteúdo do menu suspenso). */
const OptionList = ({ options, selected, multi, search, selectAll, allowAll, accent, fontSize, onToggle, onClear }: OptionsProps) => {
  const [term, setTerm] = useState("");
  const shown = useMemo(() => {
    const t = term.trim().toLowerCase();
    return t ? options.filter((option) => option.toLowerCase().includes(t)) : options;
  }, [options, term]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      {search ? (
        <div className="relative shrink-0">
          <Search className="pointer-events-none absolute start-2 top-1/2 size-3 -translate-y-1/2 opacity-60" aria-hidden />
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Pesquisar"
            aria-label="Pesquisar valores"
            className="h-7 w-full rounded-md border border-current/20 bg-transparent ps-6 pe-2 outline-none placeholder:opacity-60 focus-visible:ring-2 focus-visible:ring-ring/50"
            style={{ fontSize }}
          />
        </div>
      ) : null}
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto" role="listbox" aria-multiselectable={multi}>
        {allowAll && multi && selectAll && !term ? (
          <li>
            <Row label="Selecionar tudo" checked={selected.length === 0} onClick={onClear} accent={accent} />
          </li>
        ) : null}
        {shown.map((option) => (
          <li key={option}>
            <Row label={option} checked={selected.includes(option)} round={!multi} onClick={() => onToggle(option)} accent={accent} />
          </li>
        ))}
        {shown.length === 0 ? <li className="px-1 py-2 opacity-60">Nenhum valor</li> : null}
      </ul>
    </div>
  );
};

const Row = ({ label, checked, round, onClick, accent }: { label: string; checked: boolean; round?: boolean; onClick: () => void; accent: string }) => (
  <button
    type="button"
    role="option"
    aria-selected={checked}
    onClick={onClick}
    className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-start transition-colors hover:bg-current/10 focus-visible:bg-current/10 focus-visible:outline-none"
  >
    <Box checked={checked} round={round} accent={accent} />
    <span className="min-w-0 flex-1 truncate">{label}</span>
  </button>
);

const Tiles = ({
  options,
  selected,
  allowAll,
  accent,
  horizontal,
  onToggle,
  onClear,
}: Pick<OptionsProps, "options" | "selected" | "allowAll" | "accent" | "onToggle" | "onClear"> & { horizontal: boolean }) => (
  <div className={cn("flex gap-1.5 overflow-auto", horizontal ? "flex-row flex-wrap content-start" : "flex-col")}>
    {allowAll ? <Tile label="Todos" active={selected.length === 0} accent={accent} onClick={onClear} /> : null}
    {options.map((option) => (
      <Tile key={option} label={option} active={selected.includes(option)} accent={accent} onClick={() => onToggle(option)} />
    ))}
  </div>
);

const Tile = ({ label, active, accent, onClick }: { label: string; active: boolean; accent: string; onClick: () => void }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    title={label}
    className="max-w-full truncate rounded-md border px-2.5 py-1 text-center transition-colors hover:bg-current/10"
    style={active ? { background: accent, borderColor: accent, color: "#fff" } : { borderColor: "color-mix(in oklch, currentColor 30%, transparent)" }}
  >
    {label}
  </button>
);

export const ListSlicer = ({ element }: { element: FilterElement }) => {
  const props = element.props;
  const ctx = useDashboardData();
  const live = useFilterOptions(element);
  const s = useStyle(element);
  const value = filterValueOf(ctx, element);
  const selected = splitMulti(value);
  const multi = props.multi === true;
  const bound = Boolean(props.binding);
  const options = bound ? (live.status === "ready" ? live.data.options : []) : props.options;
  const display = props.display ?? "suspenso";
  const search = props.search ?? (display !== "blocos" && options.length > 6);

  const setValue = (next: string) => ctx.setValue(element.id, next);
  const clear = () => setValue("");
  const toggle = (option: string) => {
    if (!multi) return setValue(selected[0] === option && bound ? "" : option);
    const next = selected.includes(option) ? selected.filter((entry) => entry !== option) : [...selected, option].slice(0, FILTER_MULTI_MAX);
    setValue(joinMulti(next));
  };

  const common = { options, selected, multi, accent: s.accent, fontSize: s.fontSize, allowAll: bound, onToggle: toggle, onClear: clear };

  let body: ReactNode;
  if (display === "lista") {
    body = <OptionList {...common} search={search} selectAll={props.selectAll !== false} />;
  } else if (display === "blocos") {
    body = <Tiles {...common} horizontal={props.orientation !== "vertical"} />;
  } else {
    const summary =
      selected.length === 0 ? (bound ? "Todos" : "Selecione") : selected.length === 1 ? selected[0] : `${selected[0]} +${selected.length - 1}`;
    body = (
      <Popover.Root>
        <Popover.Trigger
          className="flex h-8 w-full items-center gap-2 rounded-md border border-current/25 bg-transparent px-2.5 text-start outline-none transition-colors hover:bg-current/5 focus-visible:ring-2 focus-visible:ring-ring/50"
          style={{ fontSize: s.fontSize }}
        >
          <span className="min-w-0 flex-1 truncate">{summary}</span>
          {bound && live.status === "loading" ? <span className="text-[10px] opacity-60">carregando…</span> : null}
          <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={4} align="start">
            <Popover.Popup
              className="z-50 flex max-h-72 w-(--anchor-width) min-w-56 flex-col rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-lg outline-none"
              style={{ fontSize: s.fontSize }}
            >
              <OptionList {...common} search={search} selectAll={props.selectAll !== false} />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    );
  }

  return (
    <Shell element={element} hasValue={selected.length > 0} onClear={clear}>
      {bound && live.status === "error" ? <p className="text-[10px] text-destructive" title={live.error}>Não foi possível carregar os valores.</p> : null}
      {body}
    </Shell>
  );
};

/* --------------------------------------------------------------- período */

const DAY = 86_400_000;
const toDay = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY);
const fromDay = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);
const isoToday = () => new Date().toISOString().slice(0, 10);

const PRESETS: { label: string; range: () => string }[] = [
  { label: "7 dias", range: () => `${fromDay(toDay(isoToday()) - 6)}..${isoToday()}` },
  { label: "30 dias", range: () => `${fromDay(toDay(isoToday()) - 29)}..${isoToday()}` },
  { label: "90 dias", range: () => `${fromDay(toDay(isoToday()) - 89)}..${isoToday()}` },
  { label: "Este ano", range: () => `${isoToday().slice(0, 4)}-01-01..${isoToday()}` },
  { label: "Tudo", range: () => "" },
];

const DateInput = ({ value, min, max, label, onChange }: { value: string; min?: string; max?: string; label: string; onChange: (v: string) => void }) => (
  <input
    type="date"
    aria-label={label}
    value={value}
    min={min}
    max={max}
    onChange={(event) => onChange(event.target.value)}
    className="h-8 min-w-0 flex-1 rounded-md border border-current/25 bg-transparent px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    style={{ colorScheme: "inherit" }}
  />
);

/** Controle deslizante com duas pontas sobre o intervalo [min, max] da coluna. */
const DualSlider = ({ min, max, from, to, accent, onChange }: { min: string; max: string; from: string; to: string; accent: string; onChange: (from: string, to: string) => void }) => {
  const lo = toDay(min);
  const hi = toDay(max);
  const span = Math.max(1, hi - lo);
  const a = Math.min(Math.max(toDay(from || min), lo), hi);
  const b = Math.min(Math.max(toDay(to || max), lo), hi);
  const pct = (day: number) => ((day - lo) / span) * 100;
  const commit = (x: number, y: number) => onChange(fromDay(Math.min(x, y)), fromDay(Math.max(x, y)));

  return (
    <div className="sd-dual relative h-5" style={{ ["--sd-accent" as string]: accent }}>
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-current opacity-20" />
      <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full" style={{ left: `${pct(a)}%`, right: `${100 - pct(b)}%`, background: accent }} />
      <input type="range" aria-label="Data inicial" min={lo} max={hi} value={a} onChange={(event) => commit(Number(event.target.value), b)} />
      <input type="range" aria-label="Data final" min={lo} max={hi} value={b} onChange={(event) => commit(a, Number(event.target.value))} />
    </div>
  );
};

export const RangeSlicer = ({ element }: { element: FilterElement }) => {
  const props = element.props;
  const ctx = useDashboardData();
  const live = useFilterOptions(element);
  const s = useStyle(element);
  const value = filterValueOf(ctx, element);
  const [from = "", to = ""] = value.split("..");
  const display = props.rangeDisplay ?? "campos";
  const bounds = live.status === "ready" && live.data.min && live.data.max ? { min: live.data.min, max: live.data.max } : null;

  const set = (nextFrom: string, nextTo: string) => {
    // intervalo igual ao da coluna inteira = sem filtro
    const all = bounds && nextFrom <= bounds.min && nextTo >= bounds.max;
    ctx.setValue(element.id, !all && (nextFrom || nextTo) ? `${nextFrom}..${nextTo}` : "");
  };

  const presets = (
    <div className="flex flex-wrap gap-1.5">
      {PRESETS.map((preset) => {
        const range = preset.range();
        return <Tile key={preset.label} label={preset.label} active={value === range} accent={s.accent} onClick={() => ctx.setValue(element.id, range)} />;
      })}
    </div>
  );

  return (
    <Shell element={element} hasValue={value !== ""} onClear={() => ctx.setValue(element.id, "")}>
      <div className="flex h-full min-h-0 flex-col justify-center gap-2 overflow-auto">
        {display === "atalhos" ? (
          presets
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <CalendarDays className="size-4 shrink-0 opacity-70" aria-hidden />
              <DateInput label="Data inicial" value={from} max={to || undefined} onChange={(v) => set(v, to)} />
              <span className="shrink-0 opacity-60">até</span>
              <DateInput label="Data final" value={to} min={from || undefined} onChange={(v) => set(from, v)} />
            </div>
            {display === "deslizante" && bounds ? (
              <DualSlider min={bounds.min} max={bounds.max} from={from} to={to} accent={s.accent} onChange={set} />
            ) : null}
            {display === "deslizante" && !bounds && props.binding ? <p className="text-[10px] opacity-60">Carregando limites das datas…</p> : null}
            {display === "campos" ? presets : null}
          </>
        )}
      </div>
    </Shell>
  );
};
