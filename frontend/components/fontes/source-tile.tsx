"use client";

import { AlertTriangle, Code2, Loader2, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { DATASET_KIND_LABELS, type Dataset } from "@/lib/datasets/store";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("pt-BR");

const pill = "w-fit rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground";

/** Dataset reabre a consulta que o criou, na fonte de origem; as demais fontes abrem com o SQL inicial. */
const editorHref = (dataset: Dataset) => {
  const params = new URLSearchParams();
  if (dataset.definition) {
    params.set("source", dataset.definition.sourceId);
    params.set("sql", dataset.definition.sql);
  } else {
    params.set("source", dataset.id);
  }
  return `/fontes-de-dados/editor?${params.toString()}`;
};

/** Cartão de uma fonte ou de um dataset salvo (que mostra de onde veio e o SQL que o criou). */
export const SourceTile = ({
  dataset,
  selected,
  onInspect,
  onRemove,
}: {
  dataset: Dataset;
  selected: boolean;
  onInspect: () => void;
  onRemove: () => void;
}) => {
  const rows = dataset.tables.reduce((sum, table) => sum + (table.rowCount ?? 0), 0);
  const definition = dataset.definition;

  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-2xl border bg-card/60 p-4 transition-colors hover:border-primary/50",
        selected ? "border-primary/60" : "border-border/70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-medium text-foreground" title={dataset.name}>
          {dataset.name}
        </h3>
        {dataset.status === "processando" ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        ) : dataset.status === "erro" ? (
          <AlertTriangle className="size-3.5 shrink-0 text-destructive" aria-label="Erro" />
        ) : null}
      </div>

      <p className="line-clamp-2 min-h-8 text-xs leading-relaxed text-muted-foreground">
        {dataset.status === "erro" ? dataset.error : dataset.description || "Sem descrição."}
      </p>

      {definition ? (
        <div className="space-y-1 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5">
          <p className="truncate text-[11px] text-muted-foreground" title={definition.sourceName}>
            Criado a partir de <strong className="font-medium text-foreground">{definition.sourceName}</strong>
          </p>
          <code className="line-clamp-2 font-mono text-[10px] leading-snug whitespace-pre-wrap text-muted-foreground">
            {definition.sql}
          </code>
        </div>
      ) : null}

      <div className="mt-1 flex flex-wrap gap-1.5">
        <span className={cn(pill, "font-medium")}>{DATASET_KIND_LABELS[dataset.kind]}</span>
        <span className={pill}>{dataset.tables.length} tabela(s)</span>
        {rows > 0 ? <span className={pill}>{definition ? "" : "~"}{nf.format(rows)} linhas</span> : null}
        {definition ? (
          <span className={pill}>{new Date(dataset.createdAt).toLocaleDateString("pt-BR")}</span>
        ) : null}
      </div>

      <div className="mt-auto flex flex-wrap justify-end gap-2 pt-1">
        {dataset.status === "pronta" ? (
          <Link
            href={editorHref(dataset)}
            title={definition ? "Reabrir a consulta que criou este dataset" : "Abrir no editor SQL"}
            className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Code2 className="size-3.5" aria-hidden />
            {definition ? "Editar consulta" : "Abrir no editor"}
          </Link>
        ) : null}
        <button
          type="button"
          disabled={dataset.status !== "pronta"}
          onClick={onInspect}
          className="flex h-8 items-center gap-1.5 rounded-md border border-border/70 px-2.5 text-xs text-foreground transition-colors hover:bg-muted/60 disabled:opacity-40"
        >
          <Search className="size-3.5" aria-hidden />
          Inspecionar
        </button>
        <button
          type="button"
          aria-label={`Excluir ${dataset.name}`}
          title="Excluir"
          onClick={onRemove}
          className="grid size-8 place-items-center rounded-md border border-border/70 text-destructive transition-colors hover:bg-destructive/10"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </div>
    </article>
  );
};
