"use client";

import { RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import { PAGE_PALETTES } from "@/lib/dashboards/page-themes";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { CANVAS_LIMITS, PAGE_PRESETS, clamp } from "@/lib/dashboards/types";
import { inputCls } from "./binding-editor";

const SizeInput = ({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}) => {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = clamp(Number(text) || value, min, max);
    setText(String(n));
    if (n !== value) onCommit(n);
  };
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        className={`${inputCls} tabular-nums`}
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
    </label>
  );
};

const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-xs text-foreground">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted"}`}
    >
      <span
        className={`absolute top-0.5 size-4 rounded-full bg-background shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  </div>
);

const BACKGROUNDS = ["#ffffff", "#f3f5f7", "#1b2326", "#0b1114", "#102a43", "#f5efe6"];

/** Tamanho da página (predefinições, personalizado, orientação) e grade do editor. */
export const PageSettings = () => {
  const canvas = useDashboardsStore((s) => (s.currentId ? s.dashboards[s.currentId]?.canvas : undefined));
  const setCanvasSize = useDashboardsStore((s) => s.setCanvasSize);
  const setCanvasBackground = useDashboardsStore((s) => s.setCanvasBackground);
  const setCanvasPalette = useDashboardsStore((s) => s.setCanvasPalette);
  const showGrid = useDashboardsStore((s) => s.showGrid);
  const snapToGrid = useDashboardsStore((s) => s.snapToGrid);
  const setShowGrid = useDashboardsStore((s) => s.setShowGrid);
  const setSnapToGrid = useDashboardsStore((s) => s.setSnapToGrid);
  if (!canvas) return null;

  const preset = PAGE_PRESETS.find((p) => p.width === canvas.width && p.height === canvas.height);
  const landscape = canvas.width >= canvas.height;

  return (
    <div className="flex flex-col gap-2.5">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-muted-foreground">Tamanho</span>
        <select
          className={`${inputCls} cursor-pointer`}
          value={preset?.id ?? "custom"}
          onChange={(e) => {
            const next = PAGE_PRESETS.find((p) => p.id === e.target.value);
            if (next) setCanvasSize({ width: next.width, height: next.height });
          }}
        >
          {PAGE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          {!preset ? <option value="custom">Personalizado ({canvas.width} × {canvas.height})</option> : null}
        </select>
      </label>
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <SizeInput
          label="Largura"
          value={canvas.width}
          min={CANVAS_LIMITS.min.w}
          max={CANVAS_LIMITS.max.w}
          onCommit={(width) => setCanvasSize({ width, height: canvas.height })}
        />
        <SizeInput
          label="Altura"
          value={canvas.height}
          min={CANVAS_LIMITS.min.h}
          max={CANVAS_LIMITS.max.h}
          onCommit={(height) => setCanvasSize({ width: canvas.width, height })}
        />
        <button
          type="button"
          title={landscape ? "Mudar para retrato" : "Mudar para paisagem"}
          aria-label="Girar orientação da página"
          onClick={() => setCanvasSize({ width: canvas.height, height: canvas.width })}
          className="grid h-[30px] w-8 place-items-center rounded-md border border-border/70 text-foreground transition-colors hover:bg-muted/60"
        >
          <RotateCw className="size-3.5" aria-hidden />
        </button>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] text-muted-foreground">Cor de fundo</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {BACKGROUNDS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Fundo ${color}`}
              aria-pressed={canvas.background === color}
              onClick={() => setCanvasBackground(color)}
              style={{ backgroundColor: color }}
              className={`size-6 rounded-md border transition-shadow ${
                canvas.background === color ? "border-primary ring-2 ring-primary/40" : "border-border/70"
              }`}
            />
          ))}
          <input
            type="color"
            aria-label="Cor de fundo personalizada"
            value={canvas.background ?? "#1b2326"}
            onChange={(e) => setCanvasBackground(e.target.value)}
            className="h-6 w-8 cursor-pointer rounded-md border border-border/70 bg-transparent p-0"
          />
          <button
            type="button"
            disabled={!canvas.background}
            onClick={() => setCanvasBackground(null)}
            className="rounded-md border border-border/70 px-2 py-1 text-[10px] text-foreground transition-colors hover:bg-muted/60 disabled:opacity-40"
          >
            Padrão do tema
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] text-muted-foreground">Paleta dos gráficos</span>
        <div className="flex flex-col gap-1">
          {PAGE_PALETTES.map((palette) => {
            const on = canvas.palette?.join() === palette.colors.join();
            return (
              <button
                key={palette.id}
                type="button"
                aria-pressed={on}
                onClick={() => setCanvasPalette(palette.colors)}
                className={`flex items-center gap-2 rounded-md border px-2 py-1 text-left text-[11px] transition-colors hover:bg-muted/60 ${
                  on ? "border-primary bg-primary/10 text-primary" : "border-border/70 text-foreground"
                }`}
              >
                <span className="flex shrink-0">
                  {palette.colors.slice(0, 5).map((color) => (
                    <span key={color} className="-ml-1 size-3.5 rounded-full border border-background first:ml-0" style={{ background: color }} />
                  ))}
                </span>
                {palette.label}
              </button>
            );
          })}
          <button
            type="button"
            disabled={!canvas.palette}
            onClick={() => setCanvasPalette(null)}
            className="self-start rounded-md border border-border/70 px-2 py-1 text-[10px] text-foreground transition-colors hover:bg-muted/60 disabled:opacity-40"
          >
            Paleta padrão do tema
          </button>
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground">
          Vale para os gráficos que não têm cores próprias.
        </p>
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground">
        Ao reduzir a página, elementos são movidos e encolhidos para caber. Ctrl+Z desfaz.
      </p>
      <Toggle label="Mostrar grade" checked={showGrid} onChange={setShowGrid} />
      <Toggle label="Encaixar na grade (8 px)" checked={snapToGrid} onChange={setSnapToGrid} />
    </div>
  );
};
