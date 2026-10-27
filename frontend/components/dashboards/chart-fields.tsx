"use client";

import { useEffect, useState } from "react";
import { parseAdvanced } from "@/lib/charts/build-option";
import { themePalette, useChartTheme } from "@/lib/charts/theme";
import type { ChartType, LegendPosition, NumberFormat } from "@shared/charts/types";
import { CHART_TYPES, CHART_TYPE_LABELS } from "@shared/charts/types";
import type { ChartColor, ChartProps } from "@/lib/dashboards/types";
import { Field, Grid2, NumberField, Section, Segmented, SelectField, SwitchRow, inputCls } from "./panel-ui";

type Set = (patch: Record<string, unknown>, field: string) => void;

const COLOR_OPTIONS: { value: ChartColor; label: string }[] = [
  { value: 1, label: "Âmbar" },
  { value: 2, label: "Turquesa" },
  { value: 3, label: "Azul" },
  { value: 4, label: "Verde" },
  { value: 5, label: "Coral" },
];

const LEGENDS: { value: LegendPosition; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "none", label: "Não" },
  { value: "top", label: "Topo" },
  { value: "bottom", label: "Base" },
  { value: "left", label: "Esq." },
  { value: "right", label: "Dir." },
];

const FORMATS: { value: NumberFormat; label: string }[] = [
  { value: "numero", label: "Número" },
  { value: "compacto", label: "Compacto (1,2 mil)" },
  { value: "moeda", label: "Moeda (R$)" },
  { value: "percentual", label: "Percentual (%)" },
];

const ADVANCED_EXAMPLE = `{
  "xAxis": { "axisLabel": { "fontSize": 13 } },
  "series": [{ "barWidth": 24 }]
}`;

const CARTESIAN: ChartType[] = ["bar", "hbar", "line", "area", "combo", "scatter"];
const MAX_PALETTE = 8;

/** Campo numérico opcional: vazio = automático. */
const OptionalNumber = ({
  value,
  placeholder,
  onChange,
}: {
  value: number | undefined;
  placeholder: string;
  onChange: (value: number | undefined) => void;
}) => {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  useEffect(() => setText(value === undefined ? "" : String(value)), [value]);
  return (
    <input
      className={`${inputCls} tabular-nums`}
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        const parsed = Number(text.replace(",", "."));
        if (text.trim() === "") onChange(undefined);
        else if (Number.isFinite(parsed)) onChange(parsed);
        else setText(value === undefined ? "" : String(value));
      }}
      onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
    />
  );
};

const TextField = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <input className={inputCls} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
);

const AdvancedField = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const trimmed = draft.trim();
  const valid = trimmed === "" || parseAdvanced(trimmed) !== null;
  return (
    <>
      <textarea
        spellCheck={false}
        className={`${inputCls} min-h-32 resize-y font-mono text-[11px] leading-relaxed ${valid ? "" : "border-destructive"}`}
        placeholder={ADVANCED_EXAMPLE}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => valid && draft !== value && onChange(draft)}
      />
      <p className={`text-[10px] leading-snug ${valid ? "text-muted-foreground" : "text-destructive"}`}>
        {valid
          ? "Opções do ECharts em JSON, mescladas por cima das configurações acima (ex.: cores, eixos, séries). Aplica ao sair do campo."
          : "JSON inválido — corrija para aplicar."}
      </p>
    </>
  );
};

export const ChartFields = ({ props, set }: { props: ChartProps; set: Set }) => {
  const theme = useChartTheme();
  const type = props.chartType;
  const cartesian = CARTESIAN.includes(type);
  const stackable = type === "bar" || type === "hbar" || type === "area" || type === "line";
  const hasLines = type === "line" || type === "area" || type === "combo" || type === "scatter";
  const base = themePalette(theme, props.color ?? 2);
  const palette = props.palette?.length ? props.palette : null;
  const colorAt = (index: number) => palette?.[index] ?? base[index % base.length];

  const setPaletteColor = (index: number, color: string) => {
    const next = Array.from({ length: MAX_PALETTE }, (_, i) => (i === index ? color : colorAt(i)));
    set({ palette: next }, "palette");
  };

  return (
    <>
      <Section title="Gráfico">
        <Field label="Tipo de gráfico">
          <SelectField
            value={type}
            options={CHART_TYPES.map((value) => ({ value, label: CHART_TYPE_LABELS[value] }))}
            onChange={(value) => set({ chartType: value }, "chartType")}
          />
        </Field>
        <Field label="Título">
          <TextField value={props.title ?? ""} onChange={(value) => set({ title: value }, "title")} />
        </Field>
        <Field label="Subtítulo">
          <TextField value={props.subtitle ?? ""} onChange={(value) => set({ subtitle: value }, "subtitle")} />
        </Field>
        <SwitchRow label="Exibir título" checked={Boolean(props.showTitle)} onChange={(value) => set({ showTitle: value }, "showTitle")} />
      </Section>

      <Section title="Cores">
        <Field label="Cor principal do tema">
          <div className="flex gap-1.5">
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color.value}
                type="button"
                title={color.label}
                aria-label={color.label}
                onClick={() => set({ color: color.value, palette: undefined }, "color")}
                className={`size-6 rounded-md border transition-transform hover:scale-110 ${
                  !palette && props.color === color.value ? "border-primary ring-1 ring-primary/60" : "border-border/70"
                }`}
                style={{ background: theme.colors[color.value] }}
              />
            ))}
          </div>
        </Field>
        <Field label={palette ? "Cores por série (personalizadas)" : "Cores por série (toque para personalizar)"}>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: MAX_PALETTE }, (_, index) => (
              <input
                key={index}
                type="color"
                aria-label={`Cor da série ${index + 1}`}
                value={colorAt(index).startsWith("#") ? colorAt(index) : "#177F76"}
                onChange={(event) => setPaletteColor(index, event.target.value)}
                className="size-7 cursor-pointer rounded-md border border-border/70 bg-transparent p-0.5"
              />
            ))}
          </div>
        </Field>
        {palette ? (
          <button
            type="button"
            onClick={() => set({ palette: undefined }, "palette")}
            className="self-start rounded-md border border-border/70 px-2 py-1 text-[10px] text-foreground transition-colors hover:bg-muted/60"
          >
            Voltar à paleta do tema
          </button>
        ) : null}
      </Section>

      <Section title="Séries e formas">
        {stackable ? (
          <Field label="Empilhamento">
            <Segmented
              value={props.stack ?? "none"}
              options={[
                { value: "none", label: "Lado a lado" },
                { value: "stack", label: "Empilhado" },
                { value: "percent", label: "100%" },
              ]}
              onChange={(value) => set({ stack: value }, "stack")}
            />
          </Field>
        ) : null}
        {type === "line" || type === "area" || type === "combo" ? (
          <>
            <SwitchRow label="Linha suavizada" checked={Boolean(props.smooth)} onChange={(value) => set({ smooth: value }, "smooth")} />
            <SwitchRow label="Mostrar pontos" checked={Boolean(props.showPoints)} onChange={(value) => set({ showPoints: value }, "showPoints")} />
          </>
        ) : null}
        {hasLines && type !== "scatter" ? (
          <Grid2>
            <Field label="Espessura da linha">
              <NumberField value={props.lineWidth ?? 2} min={1} max={10} onCommit={(value) => set({ lineWidth: value }, "lineWidth")} />
            </Field>
            {type === "area" ? (
              <Field label="Opacidade da área (%)">
                <NumberField value={Math.round((props.areaOpacity ?? 0.18) * 100)} min={0} max={100} onCommit={(value) => set({ areaOpacity: value / 100 }, "areaOpacity")} />
              </Field>
            ) : null}
          </Grid2>
        ) : null}
        {type === "bar" || type === "hbar" || type === "combo" ? (
          <Field label="Arredondamento das barras (px)">
            <NumberField value={props.barRadius ?? 4} min={0} max={24} onCommit={(value) => set({ barRadius: value }, "barRadius")} />
          </Field>
        ) : null}
        {type === "donut" ? (
          <Field label="Tamanho do furo (%)">
            <NumberField value={props.innerRadius ?? 55} min={10} max={90} onCommit={(value) => set({ innerRadius: value }, "innerRadius")} />
          </Field>
        ) : null}
        {type === "gauge" ? (
          <Grid2>
            <Field label="Mínimo">
              <OptionalNumber value={props.yMin} placeholder="0" onChange={(value) => set({ yMin: value }, "yMin")} />
            </Field>
            <Field label="Máximo (meta)">
              <OptionalNumber value={props.gaugeMax} placeholder="Auto" onChange={(value) => set({ gaugeMax: value }, "gaugeMax")} />
            </Field>
          </Grid2>
        ) : null}
        {!cartesian && type !== "donut" && type !== "gauge" ? (
          <p className="text-[10px] leading-snug text-muted-foreground">
            Este tipo usa as categorias e o primeiro valor{type === "radar" || type === "heatmap" ? " (e as séries extras)" : ""} da consulta.
          </p>
        ) : null}
      </Section>

      {cartesian ? (
        <Section title="Eixos e grade">
          <SwitchRow label="Mostrar grade" checked={props.showGrid !== false} onChange={(value) => set({ showGrid: value }, "showGrid")} />
          <Grid2>
            <Field label="Título do eixo X">
              <TextField value={props.xTitle ?? ""} onChange={(value) => set({ xTitle: value || undefined }, "xTitle")} />
            </Field>
            <Field label="Título do eixo Y">
              <TextField value={props.yTitle ?? ""} onChange={(value) => set({ yTitle: value || undefined }, "yTitle")} />
            </Field>
            <Field label="Mínimo do eixo">
              <OptionalNumber value={props.yMin} placeholder="Auto" onChange={(value) => set({ yMin: value }, "yMin")} />
            </Field>
            <Field label="Máximo do eixo">
              <OptionalNumber value={props.yMax} placeholder="Auto" onChange={(value) => set({ yMax: value }, "yMax")} />
            </Field>
          </Grid2>
          <Field label="Rotação dos rótulos">
            <Segmented
              value={String(props.rotateLabels ?? 0)}
              options={[
                { value: "0", label: "0°" },
                { value: "45", label: "45°" },
                { value: "90", label: "90°" },
              ]}
              onChange={(value) => set({ rotateLabels: Number(value) || undefined }, "rotateLabels")}
            />
          </Field>
          <SwitchRow label="Ocultar eixo X" checked={Boolean(props.hideXAxis)} onChange={(value) => set({ hideXAxis: value }, "hideXAxis")} />
          <SwitchRow label="Ocultar eixo Y" checked={Boolean(props.hideYAxis)} onChange={(value) => set({ hideYAxis: value }, "hideYAxis")} />
          <SwitchRow label="Zoom e rolagem no eixo" checked={Boolean(props.zoom)} onChange={(value) => set({ zoom: value }, "zoom")} />
          <Grid2>
            <Field label="Linha de referência">
              <OptionalNumber value={props.refLine} placeholder="Nenhuma" onChange={(value) => set({ refLine: value }, "refLine")} />
            </Field>
            <Field label="Rótulo da linha">
              <TextField value={props.refLabel ?? ""} placeholder="Meta" onChange={(value) => set({ refLabel: value || undefined }, "refLabel")} />
            </Field>
          </Grid2>
        </Section>
      ) : null}

      <Section title="Rótulos, legenda e tooltip">
        <SwitchRow label="Mostrar rótulos de valor" checked={Boolean(props.showLabels)} onChange={(value) => set({ showLabels: value }, "showLabels")} />
        <SwitchRow label="Tooltip ao passar o mouse" checked={props.showTooltip !== false} onChange={(value) => set({ showTooltip: value }, "showTooltip")} />
        <SwitchRow
          label="Clicar filtra os outros elementos"
          checked={props.crossFilter !== false}
          onChange={(value) => set({ crossFilter: value ? undefined : false }, "crossFilter")}
        />
        <Field label="Legenda">
          <SelectField value={props.legend ?? "auto"} options={LEGENDS} onChange={(value) => set({ legend: value }, "legend")} />
        </Field>
        <Field label="Formato dos valores">
          <SelectField value={props.valueFormat ?? "numero"} options={FORMATS} onChange={(value) => set({ valueFormat: value }, "valueFormat")} />
        </Field>
        <Grid2>
          <Field label="Casas decimais">
            <NumberField value={props.decimals ?? 1} min={0} max={4} onCommit={(value) => set({ decimals: value }, "decimals")} />
          </Field>
          <span />
          <Field label="Prefixo">
            <TextField value={props.prefix ?? ""} placeholder="R$ " onChange={(value) => set({ prefix: value || undefined }, "prefix")} />
          </Field>
          <Field label="Sufixo">
            <TextField value={props.suffix ?? ""} placeholder=" un" onChange={(value) => set({ suffix: value || undefined }, "suffix")} />
          </Field>
        </Grid2>
      </Section>

      <Section title="Avançado (ECharts)">
        <AdvancedField value={props.advanced ?? ""} onChange={(value) => set({ advanced: value || undefined }, "advanced")} />
      </Section>
    </>
  );
};
