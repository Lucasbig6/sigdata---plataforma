"use client";

import { AlertTriangle, ArrowLeft, Database, Loader2, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { NewSourceForm } from "@/components/fontes/new-source-form";
import { SourceDetail } from "@/components/fontes/source-detail";
import { LogoMark } from "@/components/sigdata/logo";
import { ThemeToggle } from "@/components/sigdata/theme-toggle";
import { DATASET_KIND_LABELS, useDatasetsStore } from "@/lib/datasets/store";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("pt-BR");

export default function FontesDeDadosPage() {
  const hydrated = useDatasetsStore((state) => state.hydrated);
  const loadError = useDatasetsStore((state) => state.error);
  const hydrate = useDatasetsStore((state) => state.hydrate);
  const datasets = useDatasetsStore((state) => state.datasets);
  const removeDataset = useDatasetsStore((state) => state.removeDataset);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const selected = datasets.find((dataset) => dataset.id === selectedId) ?? null;

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-card/70 backdrop-blur">
        <div className="flex h-20 items-center gap-2 px-15 sm:gap-7">
          <Link
            href="/"
            aria-label="Voltar ao início"
            className="grid size-10 shrink-0 place-items-center rounded-md border border-border/70 text-foreground transition-colors hover:bg-muted/60"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
          <LogoMark className="h-11 w-auto shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-foreground">Fontes de dados</h1>
            <p className="truncate text-xs text-muted-foreground">
              Arquivos e bancos que o assistente pode consultar
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto px-30 py-6">
        <NewSourceForm onCreated={(source) => setSelectedId(source.id)} />

        {selected ? <SourceDetail source={selected} onClose={() => setSelectedId(null)} /> : null}

        {loadError ? <p className="mb-4 text-sm text-destructive">{loadError}</p> : null}
        {removeError ? <p className="mb-4 text-sm text-destructive">{removeError}</p> : null}

        {!hydrated ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-2xl bg-muted/50" />
            ))}
          </div>
        ) : datasets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 px-6 py-20 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-muted/60 text-muted-foreground">
              <Database className="size-5" aria-hidden />
            </span>
            <p className="text-sm font-medium text-foreground">Nenhuma fonte ainda</p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              Envie um CSV/XLSX ou conecte um banco PostgreSQL acima. Depois escolha a fonte na
              barra lateral do projeto para o assistente consultar.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {datasets.map((dataset) => {
              const rows = dataset.tables.reduce((sum, table) => sum + (table.rowCount ?? 0), 0);
              return (
                <article
                  key={dataset.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-2xl border bg-card/60 p-4 transition-colors hover:border-primary/50",
                    dataset.id === selectedId ? "border-primary/60" : "border-border/70",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 truncate text-sm font-medium text-foreground">{dataset.name}</h2>
                    {dataset.status === "processando" ? (
                      <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                    ) : dataset.status === "erro" ? (
                      <AlertTriangle className="size-3.5 shrink-0 text-destructive" aria-label="Erro" />
                    ) : null}
                  </div>
                  <p className="line-clamp-2 min-h-8 text-xs leading-relaxed text-muted-foreground">
                    {dataset.status === "erro" ? dataset.error : dataset.description || "Sem descrição."}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="w-fit rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {DATASET_KIND_LABELS[dataset.kind]}
                    </span>
                    <span className="w-fit rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {dataset.tables.length} tabela(s)
                    </span>
                    {rows > 0 ? (
                      <span className="w-fit rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        ~{nf.format(rows)} linhas
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-auto flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={dataset.status !== "pronta"}
                      onClick={() => setSelectedId(dataset.id === selectedId ? null : dataset.id)}
                      className="flex h-8 items-center gap-1.5 rounded-md border border-border/70 px-2.5 text-xs text-foreground transition-colors hover:bg-muted/60 disabled:opacity-40"
                    >
                      <Search className="size-3.5" aria-hidden />
                      Inspecionar
                    </button>
                    <button
                      type="button"
                      aria-label={`Excluir ${dataset.name}`}
                      title="Excluir"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Excluir a fonte "${dataset.name}"? Projetos que a usam ficarão sem fonte.`,
                          )
                        ) {
                          setRemoveError(null);
                          if (selectedId === dataset.id) setSelectedId(null);
                          removeDataset(dataset.id).catch((error: Error) => setRemoveError(error.message));
                        }
                      }}
                      className="grid size-8 place-items-center rounded-md border border-border/70 text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
