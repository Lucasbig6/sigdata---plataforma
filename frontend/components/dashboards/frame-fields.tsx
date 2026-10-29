"use client";

import { RotateCcw } from "lucide-react";
import { FRAME_DEFAULTS } from "@/lib/dashboards/frame";
import { FRAME_LIMITS, type FrameStyle } from "@/lib/dashboards/types";
import { ColorField, Field, Grid2, NumberField, Section, Segmented, SwitchRow } from "./panel-ui";

type Set = (patch: Record<string, unknown>, field: string) => void;

/** Remove chaves indefinidas; sem nada customizado, a moldura volta ao padrão do tema. */
const clean = (frame: FrameStyle): FrameStyle | undefined => {
  const entries = Object.entries(frame).filter(([, value]) => value !== undefined);
  return entries.length > 0 ? (Object.fromEntries(entries) as FrameStyle) : undefined;
};

/** Moldura do elemento: borda, cantos, fundo, espaçamento e sombra. */
export const FrameFields = ({ frame, defaultPadding, set }: { frame: FrameStyle | undefined; defaultPadding: number; set: Set }) => {
  const f = frame ?? {};
  const enabled = f.enabled !== false;
  const update = (patch: Partial<FrameStyle>) => set({ frame: clean({ ...f, ...patch }) }, "frame");
  const transparent = f.background === "transparent";

  return (
    <Section title="Moldura e borda">
      <SwitchRow
        label="Mostrar moldura"
        checked={enabled}
        onChange={(value) => update({ enabled: value ? undefined : false })}
      />

      {enabled ? (
        <>
          <Grid2>
            <Field label="Espessura da borda (px)">
              <NumberField
                value={f.borderWidth ?? FRAME_DEFAULTS.borderWidth}
                min={FRAME_LIMITS.borderWidth.min}
                max={FRAME_LIMITS.borderWidth.max}
                onCommit={(value) => update({ borderWidth: value })}
              />
            </Field>
            <Field label="Cantos arredondados (px)">
              <NumberField
                value={f.radius ?? FRAME_DEFAULTS.radius}
                min={FRAME_LIMITS.radius.min}
                max={FRAME_LIMITS.radius.max}
                onCommit={(value) => update({ radius: value })}
              />
            </Field>
          </Grid2>

          <Field label="Estilo da borda">
            <Segmented
              value={f.borderStyle ?? FRAME_DEFAULTS.borderStyle}
              options={[
                { value: "solid", label: "Sólida" },
                { value: "dashed", label: "Tracej." },
                { value: "dotted", label: "Pontil." },
                { value: "double", label: "Dupla" },
              ]}
              onChange={(value) => update({ borderStyle: value })}
            />
          </Field>

          <Field label="Cor da borda">
            <ColorField value={f.borderColor ?? ""} onChange={(value) => update({ borderColor: value })} />
          </Field>

          <SwitchRow
            label="Fundo transparente"
            checked={transparent}
            onChange={(value) => update({ background: value ? "transparent" : undefined })}
          />
          {!transparent ? (
            <Field label="Cor de fundo">
              <ColorField value={f.background ?? ""} onChange={(value) => update({ background: value })} />
            </Field>
          ) : null}

          <Field label="Espaçamento interno (px)">
            <NumberField
              value={f.padding ?? defaultPadding}
              min={FRAME_LIMITS.padding.min}
              max={FRAME_LIMITS.padding.max}
              onCommit={(value) => update({ padding: value })}
            />
          </Field>

          <Field label="Sombra">
            <Segmented
              value={f.shadow ?? FRAME_DEFAULTS.shadow}
              options={[
                { value: "none", label: "Sem" },
                { value: "sm", label: "Leve" },
                { value: "md", label: "Média" },
                { value: "lg", label: "Forte" },
              ]}
              onChange={(value) => update({ shadow: value })}
            />
          </Field>
        </>
      ) : null}

      {frame ? (
        <button
          type="button"
          onClick={() => set({ frame: undefined }, "frame")}
          className="flex w-fit items-center gap-1.5 rounded-md border border-border/70 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <RotateCcw className="size-3" aria-hidden />
          Restaurar moldura padrão
        </button>
      ) : null}
    </Section>
  );
};
