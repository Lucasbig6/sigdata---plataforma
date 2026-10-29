"use client";

import type { FilterProps } from "@/lib/dashboards/types";
import { ColorField, Field, Grid2, NumberField, Section, Segmented, SwitchRow } from "./panel-ui";

type Set = (patch: Record<string, unknown>, field: string) => void;

/** Aparência da segmentação (filtro): tipo de exibição, seleção, busca, título e cores. */
export const FilterStyleFields = ({ props, set }: { props: FilterProps; set: Set }) => {
  const isRange = props.mode === "range";
  const display = props.display ?? "suspenso";
  const patch = (value: Record<string, unknown>, field: string) => set(value, field);

  return (
    <>
      <Section title={isRange ? "Exibição do período" : "Exibição da lista"}>
        {isRange ? (
          <Field label="Estilo">
            <Segmented
              value={props.rangeDisplay ?? "campos"}
              options={[
                { value: "campos", label: "Campos" },
                { value: "deslizante", label: "Deslizante" },
                { value: "atalhos", label: "Atalhos" },
              ]}
              onChange={(value) => patch({ rangeDisplay: value }, "rangeDisplay")}
            />
          </Field>
        ) : (
          <>
            <Field label="Estilo">
              <Segmented
                value={display}
                options={[
                  { value: "suspenso", label: "Suspenso" },
                  { value: "lista", label: "Lista" },
                  { value: "blocos", label: "Blocos" },
                ]}
                onChange={(value) => patch({ display: value }, "display")}
              />
            </Field>
            <SwitchRow label="Seleção múltipla" checked={props.multi === true} onChange={(value) => patch({ multi: value }, "multi")} />
            {display !== "blocos" ? (
              <SwitchRow
                label="Caixa de busca"
                checked={props.search ?? true}
                onChange={(value) => patch({ search: value }, "search")}
              />
            ) : (
              <Field label="Disposição">
                <Segmented
                  value={props.orientation ?? "horizontal"}
                  options={[
                    { value: "horizontal", label: "Lado a lado" },
                    { value: "vertical", label: "Empilhado" },
                  ]}
                  onChange={(value) => patch({ orientation: value }, "orientation")}
                />
              </Field>
            )}
            {props.multi === true && display !== "blocos" ? (
              <SwitchRow
                label="Linha “Selecionar tudo”"
                checked={props.selectAll !== false}
                onChange={(value) => patch({ selectAll: value }, "selectAll")}
              />
            ) : null}
          </>
        )}
        <SwitchRow label="Mostrar título" checked={props.showTitle !== false} onChange={(value) => patch({ showTitle: value }, "showTitle")} />
        <SwitchRow label="Botão de limpar (borracha)" checked={props.showClear !== false} onChange={(value) => patch({ showClear: value }, "showClear")} />
      </Section>

      <Section title="Texto e cores">
        <Grid2>
          <Field label="Tamanho do texto (px)">
            <NumberField value={props.fontSize ?? 12} min={9} max={28} onCommit={(value) => patch({ fontSize: value }, "fontSize")} />
          </Field>
        </Grid2>
        <Field label="Cor do texto">
          <ColorField value={props.textColor ?? ""} onChange={(value) => patch({ textColor: value }, "textColor")} />
        </Field>
        <Field label="Cor da seleção">
          <ColorField value={props.accent ?? ""} onChange={(value) => patch({ accent: value }, "accent")} />
        </Field>
        {props.textColor || props.accent ? (
          <button
            type="button"
            onClick={() => patch({ textColor: undefined, accent: undefined }, "colors")}
            className="w-fit rounded-md border border-border/70 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            Restaurar cores padrão
          </button>
        ) : null}
      </Section>
    </>
  );
};
