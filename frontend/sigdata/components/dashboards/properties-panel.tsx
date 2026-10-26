"use client";

import {
  BringToFront,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Eye,
  EyeOff,
  SendToBack,
  Trash2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { listAnalyses } from "@/lib/dashboards/analyses";
import {
  CATEGORY_LABELS,
  FILTER_KIND_LABELS,
  FILTER_OPTIONS,
  VALUE_LABELS,
  datasetSourceOptions,
  valueOptionsFor,
} from "@/lib/dashboards/datasets";
import { useDashboardsStore } from "@/lib/dashboards/store";
import {
  ELEMENT_MIN,
  clamp,
  type ChartColor,
  type ChartType,
  type DatasetRef,
  type DashboardElement,
  type FilterKind,
} from "@/lib/dashboards/types";
import { ELEMENT_LABELS } from "./element-renderers";
import { useChartTheme } from "./charts";

const inputCls =
  "w-full rounded-md border border-border/70 bg-background px-2 py-1.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/50";

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="flex flex-col gap-2.5 border-b border-border/50 px-3 py-3.5">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {title}
    </p>
    {children}
  </section>
);

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="flex min-w-0 flex-col gap-1">
    <span className="text-[11px] text-muted-foreground">{label}</span>
    {children}
  </label>
);

const Grid2 = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-2 gap-2">{children}</div>
);

function Segmented<T extends string>({
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

const SwitchRow = ({
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

const NumberField = ({
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

const ColorField = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
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

type SelectOption = { value: string; label: string; group?: string | null };

const SelectField = ({
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

const CHART_OPTIONS: { value: ChartType; label: string }[] = [
  { value: "bar", label: "Barras" },
  { value: "line", label: "Linhas" },
  { value: "area", label: "Área" },
  { value: "pie", label: "Pizza" },
];

const COLOR_OPTIONS: { value: ChartColor; label: string }[] = [
  { value: 1, label: "Âmbar" },
  { value: 2, label: "Turquesa" },
  { value: 3, label: "Azul" },
  { value: 4, label: "Verde" },
  { value: 5, label: "Coral" },
];

const datasetValue = (dataset: DatasetRef): string =>
  dataset.source === "analysis" ? dataset.ref : "demo";

const GeometryFields = ({
  element,
  canvas,
  patchElement,
}: {
  element: DashboardElement;
  canvas: { width: number; height: number };
  patchElement: ReturnType<typeof useDashboardsStore.getState>["patchElement"];
}) => {
  const geometry = [
    { key: "x" as const, label: "X", min: 0, max: Math.max(0, canvas.width - element.w) },
    { key: "y" as const, label: "Y", min: 0, max: Math.max(0, canvas.height - element.h) },
    { key: "w" as const, label: "Largura", min: ELEMENT_MIN[element.type].w, max: canvas.width },
    { key: "h" as const, label: "Altura", min: ELEMENT_MIN[element.type].h, max: canvas.height },
  ];

  return (
    <Section title="Posição e tamanho">
      <Grid2>
        {geometry.map((entry) => (
          <Field key={entry.key} label={entry.label}>
            <NumberField
              value={element[entry.key]}
              min={entry.min}
              max={entry.max}
              onCommit={(next) =>
                patchElement(element.id, { [entry.key]: next } as Partial<DashboardElement>, {
                  transaction: `geom:${element.id}:${entry.key}`,
                })
              }
            />
          </Field>
        ))}
      </Grid2>
    </Section>
  );
};

const DatasetFields = ({
  dataset,
  onChange,
  analyses,
}: {
  dataset: DatasetRef;
  onChange: (dataset: DatasetRef) => void;
  analyses: { id: string; title: string }[];
}) => (
  <>
    <Field label="Fonte de dados">
      <SelectField
        value={datasetValue(dataset)}
        options={datasetSourceOptions(analyses)}
        onChange={(value) =>
          onChange(
            value === "demo"
              ? { ...dataset, source: "demo", ref: "demo" }
              : { ...dataset, source: "analysis", ref: value },
          )
        }
      />
    </Field>
    <Grid2>
      <Field label={CATEGORY_LABELS[dataset.categoryField]}>
        <SelectField
          value={dataset.categoryField}
          options={[
            { value: "periodo", label: CATEGORY_LABELS.periodo },
            { value: "municipio", label: CATEGORY_LABELS.municipio },
          ]}
          onChange={(value) => {
            const categoryField = value as DatasetRef["categoryField"];
            onChange({
              ...dataset,
              categoryField,
              valueField: valueOptionsFor(categoryField)[0],
            });
          }}
        />
      </Field>
      {dataset.categoryField !== "periodo" ? (
        <Field label={VALUE_LABELS[dataset.valueField]}>
          <SelectField
            value={dataset.valueField}
            options={valueOptionsFor(dataset.categoryField).map((field) => ({
              value: field,
              label: VALUE_LABELS[field],
            }))}
            onChange={(value) =>
              onChange({ ...dataset, valueField: value as DatasetRef["valueField"] })
            }
          />
        </Field>
      ) : null}
    </Grid2>
    <p className="text-[10px] leading-snug text-muted-foreground">
      {dataset.source === "demo"
        ? "Conjunto fictício de demonstração — nenhuma fonte real conectada."
        : "Snapshot de análise salva na conversa (dados de demonstração)."}
    </p>
  </>
);

const TypeFields = ({
  element,
  updateProps,
  analyses,
}: {
  element: DashboardElement;
  updateProps: (id: string, patch: Record<string, unknown>, field?: string) => void;
  analyses: { id: string; title: string }[];
}) => {
  const set = (patch: Record<string, unknown>, field: string) =>
    updateProps(element.id, patch, field);
  const props = element.props as Record<string, unknown>;
  const { resolvedTheme } = useTheme();
  const chartTheme = useChartTheme();
  const textDefault = resolvedTheme === "dark" ? "#E8ECEF" : "#16202E";

  switch (element.type) {
    case "chart":
      return (
        <Section title="Conteúdo">
          <Field label="Tipo de gráfico">
            <Segmented
              value={props.chartType as ChartType}
              options={CHART_OPTIONS}
              onChange={(value) => set({ chartType: value }, "chartType")}
            />
          </Field>
          <Field label="Título">
            <input
              className={inputCls}
              value={String(props.title ?? "")}
              onChange={(event) => set({ title: event.target.value }, "title")}
            />
          </Field>
          <Field label="Subtítulo">
            <input
              className={inputCls}
              value={String(props.subtitle ?? "")}
              onChange={(event) => set({ subtitle: event.target.value }, "subtitle")}
            />
          </Field>
          <SwitchRow
            label="Exibir título"
            checked={Boolean(props.showTitle)}
            onChange={(value) => set({ showTitle: value }, "showTitle")}
          />
          <Field label="Cor da série">
            <div className="flex gap-1.5">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  title={color.label}
                  aria-label={color.label}
                  onClick={() => set({ color: color.value }, "color")}
                  className={`size-6 rounded-md border transition-transform hover:scale-110 ${
                    props.color === color.value
                      ? "border-primary ring-1 ring-primary/60"
                      : "border-border/70"
                  }`}
                  style={{ background: chartTheme.colors[color.value] }}
                />
              ))}
            </div>
          </Field>
          {String(props.chartType) === "pie" ? (
            <SwitchRow
              label="Mostrar legenda"
              checked={Boolean(props.showLegend)}
              onChange={(value) => set({ showLegend: value }, "showLegend")}
            />
          ) : (
            <SwitchRow
              label="Mostrar grade"
              checked={Boolean(props.showGrid)}
              onChange={(value) => set({ showGrid: value }, "showGrid")}
            />
          )}
          <DatasetFields
            dataset={props.dataset as DatasetRef}
            onChange={(dataset) => set({ dataset }, "dataset")}
            analyses={analyses}
          />
        </Section>
      );

    case "table":
      return (
        <Section title="Conteúdo">
          <Field label="Título">
            <input
              className={inputCls}
              value={String(props.title ?? "")}
              onChange={(event) => set({ title: event.target.value }, "title")}
            />
          </Field>
          <SwitchRow
            label="Exibir título"
            checked={Boolean(props.showTitle)}
            onChange={(value) => set({ showTitle: value }, "showTitle")}
          />
          <Field label="Densidade">
            <Segmented
              value={String(props.density ?? "confortavel")}
              options={[
                { value: "compacta", label: "Compacta" },
                { value: "confortavel", label: "Confortável" },
              ]}
              onChange={(value) => set({ density: value }, "density")}
            />
          </Field>
          <DatasetFields
            dataset={props.dataset as DatasetRef}
            onChange={(dataset) => set({ dataset }, "dataset")}
            analyses={analyses}
          />
        </Section>
      );

    case "kpi":
    case "percent":
    case "comparison":
      return (
        <Section title="Conteúdo">
          <Field label="Título">
            <input
              className={inputCls}
              value={String(props.title ?? "")}
              onChange={(event) => set({ title: event.target.value }, "title")}
            />
          </Field>
          <Grid2>
            <Field label="Valor">
              <input
                className={inputCls}
                value={String(props.value ?? "")}
                onChange={(event) => set({ value: event.target.value }, "value")}
              />
            </Field>
            <Field label="Unidade">
              <input
                className={inputCls}
                placeholder="—"
                value={String(props.unit ?? "")}
                onChange={(event) => set({ unit: event.target.value }, "unit")}
              />
            </Field>
          </Grid2>
          <Field label="Descrição">
            <input
              className={inputCls}
              value={String(props.description ?? "")}
              onChange={(event) => set({ description: event.target.value }, "description")}
            />
          </Field>
          <SwitchRow
            label="Mostrar variação"
            checked={Boolean(props.showDelta)}
            onChange={(value) => set({ showDelta: value }, "showDelta")}
          />
          {props.showDelta ? (
            <Field label="Variação (%)">
              <NumberField
                value={Number(props.delta ?? 0)}
                min={-100}
                max={100}
                onCommit={(next) => set({ delta: next }, "delta")}
              />
            </Field>
          ) : null}
        </Section>
      );

    case "text":
    case "title":
      return (
        <Section title="Conteúdo">
          <Field label="Texto">
            <textarea
              className={`${inputCls} min-h-24 resize-y leading-relaxed`}
              value={String(props.content ?? "")}
              onChange={(event) => set({ content: event.target.value }, "content")}
            />
          </Field>
          <Grid2>
            <Field label="Tamanho (px)">
              <NumberField
                value={Number(props.fontSize ?? 16)}
                min={10}
                max={72}
                onCommit={(next) => set({ fontSize: next }, "fontSize")}
              />
            </Field>
            <Field label="Alinhamento">
              <Segmented
                value={String(props.align ?? "left")}
                options={[
                  { value: "left", label: "Esq." },
                  { value: "center", label: "Centro" },
                  { value: "right", label: "Dir." },
                ]}
                onChange={(value) => set({ align: value }, "align")}
              />
            </Field>
          </Grid2>
          <SwitchRow
            label="Negrito"
            checked={Boolean(props.bold)}
            onChange={(value) => set({ bold: value }, "bold")}
          />
          <Field label="Cor">
            <ColorField
              value={String(props.color ?? textDefault)}
              onChange={(value) => set({ color: value }, "color")}
            />
          </Field>
        </Section>
      );

    case "image":
      return (
        <Section title="Conteúdo">
          <Field label="Texto alternativo">
            <input
              className={inputCls}
              value={String(props.alt ?? "")}
              onChange={(event) => set({ alt: event.target.value }, "alt")}
            />
          </Field>
          <Field label="Estilo">
            <Segmented
              value={String(props.variant ?? "gradiente")}
              options={[
                { value: "gradiente", label: "Gradiente" },
                { value: "malha", label: "Malha" },
                { value: "ondas", label: "Ondas" },
              ]}
              onChange={(value) => set({ variant: value }, "variant")}
            />
          </Field>
          <Field label="Ajuste">
            <Segmented
              value={String(props.fit ?? "cover")}
              options={[
                { value: "cover", label: "Preencher" },
                { value: "contain", label: "Conter" },
              ]}
              onChange={(value) => set({ fit: value }, "fit")}
            />
          </Field>
          <Field label="Cor de destaque">
            <div className="flex gap-1.5">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  title={color.label}
                  aria-label={color.label}
                  onClick={() => set({ accent: color.value }, "accent")}
                  className={`size-6 rounded-md border transition-transform hover:scale-110 ${
                    props.accent === color.value
                      ? "border-primary ring-1 ring-primary/60"
                      : "border-border/70"
                  }`}
                  style={{ background: chartTheme.colors[color.value] }}
                />
              ))}
            </div>
          </Field>
          <p className="text-[10px] text-muted-foreground">
            Ilustração gerada localmente — não representa um arquivo real.
          </p>
        </Section>
      );

    case "divider":
      return (
        <Section title="Aparência">
          <Grid2>
            <Field label="Espessura (px)">
              <NumberField
                value={Number(props.thickness ?? 2)}
                min={1}
                max={16}
                onCommit={(next) => set({ thickness: next }, "thickness")}
              />
            </Field>
            <Field label="Estilo">
              <Segmented
                value={String(props.style ?? "solid")}
                options={[
                  { value: "solid", label: "Sólido" },
                  { value: "dashed", label: "Tracejado" },
                ]}
                onChange={(value) => set({ style: value }, "style")}
              />
            </Field>
          </Grid2>
          <Field label="Cor">
            <ColorField
              value={String(props.color ?? "#39464B")}
              onChange={(value) => set({ color: value }, "color")}
            />
          </Field>
        </Section>
      );

    case "shape":
      return (
        <Section title="Aparência">
          <Field label="Forma">
            <Segmented
              value={String(props.shape ?? "retangulo")}
              options={[
                { value: "retangulo", label: "Retângulo" },
                { value: "circulo", label: "Círculo" },
              ]}
              onChange={(value) => set({ shape: value }, "shape")}
            />
          </Field>
          <Grid2>
            <Field label="Preenchimento (CSS)">
              <input
                className={inputCls}
                value={String(props.fill ?? "")}
                onChange={(event) => set({ fill: event.target.value }, "fill")}
              />
            </Field>
            <Field label="Borda (CSS)">
              <input
                className={inputCls}
                value={String(props.border ?? "")}
                onChange={(event) => set({ border: event.target.value }, "border")}
              />
            </Field>
          </Grid2>
          <Grid2>
            <Field label="Espessura da borda">
              <NumberField
                value={Number(props.borderWidth ?? 1)}
                min={0}
                max={16}
                onCommit={(next) => set({ borderWidth: next }, "borderWidth")}
              />
            </Field>
            <Field label="Arredondamento">
              <NumberField
                value={Number(props.radius ?? 0)}
                min={0}
                max={999}
                onCommit={(next) => set({ radius: next }, "radius")}
              />
            </Field>
          </Grid2>
        </Section>
      );

    case "filter":
      return (
        <Section title="Filtro demonstrativo">
          <Field label="Rótulo">
            <input
              className={inputCls}
              value={String(props.label ?? "")}
              onChange={(event) => set({ label: event.target.value }, "label")}
            />
          </Field>
          <Field label="Tipo">
            <Segmented
              value={String(props.kind ?? "periodo")}
              options={[
                { value: "periodo", label: FILTER_KIND_LABELS.periodo },
                { value: "categoria", label: FILTER_KIND_LABELS.categoria },
                { value: "municipio", label: FILTER_KIND_LABELS.municipio },
              ]}
              onChange={(value) => {
                const kind = value as FilterKind;
                const options = FILTER_OPTIONS[kind];
                set({ kind, options, value: options[0] }, "kind");
              }}
            />
          </Field>
          <Field label="Opção selecionada">
            <SelectField
              value={String(props.value ?? "")}
              options={((props.options as string[] | undefined) ?? []).map((option) => ({
                value: option,
                label: option,
              }))}
              onChange={(value) => set({ value }, "value")}
            />
          </Field>
          <p className="text-[10px] leading-snug text-muted-foreground">
            O seletor muda apenas a própria opção exibida: nenhum filtro é aplicado aos gráficos
            (demonstração).
          </p>
        </Section>
      );

    default:
      return null;
  }
};

const LayerActions = ({
  element,
  setHidden,
  moveLayer,
  duplicateElement,
  removeElement,
  select,
}: {
  element: DashboardElement;
  setHidden: ReturnType<typeof useDashboardsStore.getState>["setHidden"];
  moveLayer: ReturnType<typeof useDashboardsStore.getState>["moveLayer"];
  duplicateElement: ReturnType<typeof useDashboardsStore.getState>["duplicateElement"];
  removeElement: ReturnType<typeof useDashboardsStore.getState>["removeElement"];
  select: ReturnType<typeof useDashboardsStore.getState>["select"];
}) => {
  const buttons: {
    label: string;
    icon: ReactNode;
    onClick: () => void;
    danger?: boolean;
  }[] = [
    {
      label: "Trazer para frente",
      icon: <BringToFront className="size-4" aria-hidden />,
      onClick: () => moveLayer(element.id, "front"),
    },
    {
      label: "Subir uma camada",
      icon: <ChevronsUp className="size-4" aria-hidden />,
      onClick: () => moveLayer(element.id, "up"),
    },
    {
      label: "Descer uma camada",
      icon: <ChevronsDown className="size-4" aria-hidden />,
      onClick: () => moveLayer(element.id, "down"),
    },
    {
      label: "Enviar para trás",
      icon: <SendToBack className="size-4" aria-hidden />,
      onClick: () => moveLayer(element.id, "back"),
    },
    {
      label: element.hidden ? "Mostrar" : "Ocultar",
      icon: element.hidden ? (
        <EyeOff className="size-4" aria-hidden />
      ) : (
        <Eye className="size-4" aria-hidden />
      ),
      onClick: () => setHidden(element.id, !element.hidden),
    },
    {
      label: "Duplicar",
      icon: <Copy className="size-4" aria-hidden />,
      onClick: () => duplicateElement(element.id),
    },
    {
      label: "Excluir",
      icon: <Trash2 className="size-4" aria-hidden />,
      danger: true,
      onClick: () => {
        removeElement(element.id);
        select(null);
      },
    },
  ];

  return (
    <Section title="Camada e ações">
      <div className="grid grid-cols-4 gap-1.5">
        {buttons.map((button) => (
          <button
            key={button.label}
            type="button"
            title={button.label}
            aria-label={button.label}
            onClick={button.onClick}
            className={`grid size-full place-items-center rounded-md border border-border/70 bg-background py-2 transition-colors hover:border-border hover:bg-muted/60 ${
              button.danger ? "text-destructive hover:border-destructive/50" : "text-foreground"
            }`}
          >
            {button.icon}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Atalhos: setas movem (Shift = 10px), Delete exclui, Ctrl/Cmd+Z desfaz.
      </p>
    </Section>
  );
};

export const PropertiesPanel = () => {
  const doc = useDashboardsStore((state) =>
    state.currentId ? (state.dashboards[state.currentId] ?? null) : null,
  );
  const selectedId = useDashboardsStore((state) => state.selectedId);
  const updateProps = useDashboardsStore((state) => state.updateProps);
  const patchElement = useDashboardsStore((state) => state.patchElement);
  const moveLayer = useDashboardsStore((state) => state.moveLayer);
  const duplicateElement = useDashboardsStore((state) => state.duplicateElement);
  const removeElement = useDashboardsStore((state) => state.removeElement);
  const setHidden = useDashboardsStore((state) => state.setHidden);
  const select = useDashboardsStore((state) => state.select);

  const element = doc ? (doc.elements.find((entry) => entry.id === selectedId) ?? null) : null;
  const analyses = listAnalyses();

  if (!doc) return null;

  if (!element) {
    return (
      <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-border/60 bg-card/40 xl:flex">
        <div className="border-b border-border/60 px-3 py-2.5">
          <p className="text-xs font-semibold text-foreground">Propriedades</p>
          <p className="text-[10px] text-muted-foreground">Nenhum elemento selecionado</p>
        </div>
        <Section title="Painel">
          <p className="text-xs font-medium text-foreground">{doc.name}</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {doc.description || "Sem descrição."}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
              {doc.elements.length} elementos
            </span>
            <span className="rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
              {doc.canvas.width}×{doc.canvas.height}
            </span>
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
              {doc.origin === "demo" ? "Demonstração" : "Criado por você"}
            </span>
          </div>
        </Section>
        <Section title="Como usar">
          <ul className="flex list-disc flex-col gap-1.5 pl-4 text-[11px] leading-relaxed text-muted-foreground">
            <li>Clique em um elemento da biblioteca para inserir.</li>
            <li>Arraste elementos no canvas para posicionar.</li>
            <li>Puxe as bordas para redimensionar.</li>
            <li>Clique em um elemento para editar propriedades.</li>
            <li>Use Ctrl/Cmd+Z para desfazer e Ctrl/Cmd+S para salvar.</li>
          </ul>
        </Section>
      </aside>
    );
  }

  return (
    <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-border/60 bg-card/40 xl:flex">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border/60 bg-card/80 px-3 py-2.5 backdrop-blur">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">
            {ELEMENT_LABELS[element.type]}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">{element.id}</p>
        </div>
        <button
          type="button"
          onClick={() => select(null)}
          className="rounded-md border border-border/70 px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Limpar
        </button>
      </div>

      <GeometryFields element={element} canvas={doc.canvas} patchElement={patchElement} />
      <TypeFields element={element} updateProps={updateProps} analyses={analyses} />
      <LayerActions
        element={element}
        setHidden={setHidden}
        moveLayer={moveLayer}
        duplicateElement={duplicateElement}
        removeElement={removeElement}
        select={select}
      />
    </aside>
  );
};
