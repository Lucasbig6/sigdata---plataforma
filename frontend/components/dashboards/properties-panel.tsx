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
import { useState, type ReactNode } from "react";
import { useDashboardsStore } from "@/lib/dashboards/store";
import {
  ELEMENT_MIN,
  type ChartColor,
  type ChartProps,
  type DashboardElement,
  type FilterProps,
  type FrameStyle,
} from "@/lib/dashboards/types";
import type { DataBinding, FilterBinding, NumberFormat } from "@/lib/dashboards/types";
import { ChartFields } from "./chart-fields";
import { DataSummary, NoDataNote } from "./data-summary";
import { FilterStyleFields } from "./filter-fields";
import { FrameFields } from "./frame-fields";
import { LayersPanel } from "./layers-panel";
import { MeasuresPanel } from "./measures-panel";
import { BindingEditor, FilterBindingEditor } from "./binding-editor";
import { ELEMENT_LABELS } from "./element-renderers";
import { PageSettings } from "./page-settings";
import {
  ColorField,
  Field,
  Grid2,
  NumberField,
  Section,
  SelectField,
  Segmented,
  SwitchRow,
  inputCls,
} from "./panel-ui";
import { useChartTheme } from "./charts";

const COLOR_OPTIONS: { value: ChartColor; label: string }[] = [
  { value: 1, label: "Âmbar" },
  { value: 2, label: "Turquesa" },
  { value: 3, label: "Azul" },
  { value: 4, label: "Verde" },
  { value: 5, label: "Coral" },
];

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

const TypeFieldsBody = ({
  element,
  updateProps,
}: {
  element: DashboardElement;
  updateProps: (id: string, patch: Record<string, unknown>, field?: string) => void;
}) => {
  const set = (patch: Record<string, unknown>, field: string) =>
    updateProps(element.id, patch, field);
  const props = element.props as Record<string, unknown>;
  const { resolvedTheme } = useTheme();
  const chartTheme = useChartTheme();
  const textDefault = resolvedTheme === "dark" ? "#E8ECEF" : "#16202E";

  switch (element.type) {
    case "chart":
      return <ChartFields props={element.props as ChartProps} set={set} />;

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
          {props.binding ? (
            <Grid2>
              <Field label="Formato">
                <SelectField
                  value={String(props.format ?? "numero")}
                  options={[
                    { value: "numero", label: "Número" },
                    { value: "moeda", label: "Moeda (R$)" },
                    { value: "percentual", label: "Percentual" },
                    { value: "compacto", label: "Compacto (1,2 mi)" },
                  ]}
                  onChange={(value) => set({ format: value as NumberFormat }, "format")}
                />
              </Field>
              <Field label="Casas decimais">
                <NumberField
                  value={Number(props.decimals ?? 1)}
                  min={0}
                  max={4}
                  onCommit={(next) => set({ decimals: next }, "decimals")}
                />
              </Field>
            </Grid2>
          ) : null}
          <Grid2>
            {!props.binding ? (
              <Field label="Valor">
                <input
                  className={inputCls}
                  value={String(props.value ?? "")}
                  onChange={(event) => set({ value: event.target.value }, "value")}
                />
              </Field>
            ) : null}
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
            <Field label="Variação (%) — informada manualmente">
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
          <Field label="Endereço da imagem (https://…)">
            <input
              className={inputCls}
              placeholder="Vazio = ilustração gerada"
              value={String(props.src ?? "")}
              onChange={(event) => set({ src: event.target.value.trim() }, "src")}
            />
          </Field>
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
            Estilo e cor valem para a ilustração (quando não há endereço de imagem).
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
        <Section title="Conteúdo">
          <Field label="Rótulo">
            <input
              className={inputCls}
              value={String(props.label ?? "")}
              onChange={(event) => set({ label: event.target.value }, "label")}
            />
          </Field>
          {!props.binding ? (
            <p className="text-[10px] leading-snug text-muted-foreground">
              Filtro sem coluna ligada: escolha a fonte e a coluna na aba Dados para que ele filtre o
              painel.
            </p>
          ) : null}
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

/** Tipos de dados que têm moldura (borda, fundo, cantos, sombra). */
const FRAMED = new Set<DashboardElement["type"]>(["chart", "table", "kpi", "percent", "comparison", "filter"]);

const TypeFields = ({
  element,
  updateProps,
}: {
  element: DashboardElement;
  updateProps: (id: string, patch: Record<string, unknown>, field?: string) => void;
}) => (
  <>
    <TypeFieldsBody element={element} updateProps={updateProps} />
    {element.type === "filter" ? (
      <FilterStyleFields props={element.props as FilterProps} set={(patch, field) => updateProps(element.id, patch, field)} />
    ) : null}
    {FRAMED.has(element.type) ? (
      <FrameFields
        frame={(element.props as { frame?: FrameStyle }).frame}
        defaultPadding={element.type === "chart" ? 12 : element.type === "filter" ? 10 : 0}
        set={(patch, field) => updateProps(element.id, patch, field)}
      />
    ) : null}
  </>
);

export const PropertiesPanel = () => {
  const doc = useDashboardsStore((state) =>
    state.currentId ? (state.dashboards[state.currentId] ?? null) : null,
  );
  const selectedId = useDashboardsStore((state) => state.selectedId);
  const selectedIds = useDashboardsStore((state) => state.selectedIds);
  const duplicateSelected = useDashboardsStore((state) => state.duplicateSelected);
  const groupSelected = useDashboardsStore((state) => state.groupSelected);
  const ungroupSelected = useDashboardsStore((state) => state.ungroupSelected);
  const setHiddenSelected = useDashboardsStore((state) => state.setHiddenSelected);
  const removeSelected = useDashboardsStore((state) => state.removeSelected);
  const updateProps = useDashboardsStore((state) => state.updateProps);
  const patchElement = useDashboardsStore((state) => state.patchElement);
  const moveLayer = useDashboardsStore((state) => state.moveLayer);
  const duplicateElement = useDashboardsStore((state) => state.duplicateElement);
  const removeElement = useDashboardsStore((state) => state.removeElement);
  const setHidden = useDashboardsStore((state) => state.setHidden);
  const select = useDashboardsStore((state) => state.select);

  const element = doc ? (doc.elements.find((entry) => entry.id === selectedId) ?? null) : null;
  const [tab, setTab] = useState<PanelTab>("dados");

  if (!doc) return null;

  if (!element && selectedIds.length > 1) {
    const actionCls =
      "rounded-md border border-border/70 px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/60";
    return (
      <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-border/60 bg-card/40 xl:flex">
        <div className="border-b border-border/60 px-3 py-2.5">
          <p className="text-xs font-semibold text-foreground">{selectedIds.length} elementos selecionados</p>
          <p className="text-[10px] text-muted-foreground">Arraste para mover todos juntos</p>
        </div>
        <Section title="Ações">
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" className={actionCls} onClick={duplicateSelected}>
              Duplicar
            </button>
            <button type="button" className={actionCls} onClick={() => setHiddenSelected(true)}>
              Ocultar
            </button>
            <button type="button" className={actionCls} onClick={groupSelected}>
              Agrupar
            </button>
            <button type="button" className={actionCls} onClick={ungroupSelected}>
              Desagrupar
            </button>
          </div>
          <button
            type="button"
            onClick={removeSelected}
            className="rounded-md border border-destructive/40 px-2 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10"
          >
            Excluir seleção
          </button>
        </Section>
        <Section title="Alinhar e distribuir">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Use a barra no topo da página para alinhar, distribuir e igualar tamanhos.
          </p>
        </Section>
        <Section title="Camadas">
          <LayersPanel />
        </Section>
      </aside>
    );
  }

  if (!element) {
    return (
      <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-border/60 bg-card/40 xl:flex">
        <div className="border-b border-border/60 px-3 py-2.5">
          <p className="text-xs font-semibold text-foreground">Página</p>
          <p className="text-[10px] text-muted-foreground">Nenhum elemento selecionado</p>
        </div>
        <Section title="Tamanho da página">
          <PageSettings />
        </Section>
        <Section title="Painel">
          <p className="text-xs font-medium text-foreground">{doc.name}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
              {doc.elements.length} elementos
            </span>
            <span className="rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
              {doc.elements.filter((el) => (el.props as { binding?: unknown }).binding).length} com dados ao vivo
            </span>
          </div>
        </Section>
        <Section title="Medidas calculadas">
          <MeasuresPanel />
        </Section>
        <Section title="Camadas">
          <LayersPanel />
        </Section>
        <Section title="Atalhos">
          <ul className="flex list-disc flex-col gap-1.5 pl-4 text-[11px] leading-relaxed text-muted-foreground">
            <li>Arraste um retângulo no fundo (ou Shift+clique) para selecionar vários.</li>
            <li>Setas movem a seleção (Shift = 10 px); Delete exclui.</li>
            <li>Ctrl+C / X / V copiam, recortam e colam, até entre painéis.</li>
            <li>Ctrl+D duplica · Ctrl+G agrupa · Ctrl+A seleciona tudo.</li>
            <li>Ctrl+Z desfaz · Ctrl+S salva · botão direito abre o menu.</li>
            <li>Solte uma coluna da aba Dados sobre um gráfico para trocar os campos (Alt troca o eixo X).</li>
          </ul>
        </Section>
      </aside>
    );
  }

  const hasData = DATA_TYPES.has(element.type);
  const activeTab: PanelTab = !hasData && tab === "dados" ? "estilo" : tab;
  const props = element.props as Record<string, unknown>;

  return (
    <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-border/60 bg-card/40 xl:flex">
      <div className="sticky top-0 z-10 border-b border-border/60 bg-card/90 backdrop-blur">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">
              {ELEMENT_LABELS[element.type]}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              {String(props.title ?? props.label ?? element.id)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => select(null)}
            className="rounded-md border border-border/70 px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Fechar
          </button>
        </div>
        <div role="tablist" className="flex gap-1 px-3 pb-2">
          {PANEL_TABS.filter((t) => hasData || t.id !== "dados").map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                activeTab === t.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "dados" ? (
        <Section title="Dados">
          {element.type === "filter" ? (
            <FilterBindingEditor
              binding={props.binding as FilterBinding | undefined}
              value={String(props.value ?? "")}
              mode={props.mode === "range" ? "range" : "list"}
              global={props.global === true}
              onChange={(patch) => updateProps(element.id, patch, "binding")}
            />
          ) : (
            <>
              {!props.binding ? (
                <NoDataNote />
              ) : (props.binding as DataBinding).mode === "sql" ? (
                <DataSummary binding={props.binding as DataBinding} />
              ) : (
                // dashboards antigos com ligação do construtor continuam editáveis
                <BindingEditor
                  elementId={element.id}
                  type={element.type}
                  binding={props.binding as DataBinding | undefined}
                  onChange={(binding) => updateProps(element.id, { binding }, "binding")}
                />
              )}
              {props.binding ? (
                <SwitchRow
                  label="Ignorar filtros do painel"
                  checked={Boolean(props.ignoreFilters)}
                  onChange={(value) => updateProps(element.id, { ignoreFilters: value || undefined }, "ignoreFilters")}
                />
              ) : null}
            </>
          )}
        </Section>
      ) : null}

      {activeTab === "estilo" ? (
        <TypeFields element={element} updateProps={updateProps} />
      ) : null}

      {activeTab === "layout" ? (
        <>
          <GeometryFields element={element} canvas={doc.canvas} patchElement={patchElement} />
          <LayerActions
            element={element}
            setHidden={setHidden}
            moveLayer={moveLayer}
            duplicateElement={duplicateElement}
            removeElement={removeElement}
            select={select}
          />
          <Section title="Celular">
            <SwitchRow
              label="Ocultar no layout para celular"
              checked={Boolean(element.hideOnMobile)}
              onChange={(value) => patchElement(element.id, { hideOnMobile: value || undefined })}
            />
            <p className="text-[10px] leading-snug text-muted-foreground">
              No celular os elementos viram uma coluna, na ordem de leitura. Use isto para tirar o que não cabe.
            </p>
          </Section>
        </>
      ) : null}
    </aside>
  );
};

type PanelTab = "dados" | "estilo" | "layout";

const PANEL_TABS: { id: PanelTab; label: string }[] = [
  { id: "dados", label: "Dados" },
  { id: "estilo", label: "Estilo" },
  { id: "layout", label: "Layout" },
];

const DATA_TYPES = new Set<DashboardElement["type"]>([
  "chart",
  "table",
  "kpi",
  "percent",
  "comparison",
  "filter",
]);
