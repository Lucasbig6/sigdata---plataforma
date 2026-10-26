"use client";

import { ArrowLeft, Database, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDatasetsStore, DATASET_KIND_LABELS, type DatasetKind } from "@/lib/datasets/store";
import { LogoMark } from "@/components/sigdata/logo";
import { ThemeToggle } from "@/components/sigdata/theme-toggle";

const KIND_OPTIONS = Object.entries(DATASET_KIND_LABELS) as [DatasetKind, string][];

export default function FontesDeDadosPage() {
  const hydrated = useDatasetsStore((state) => state.hydrated);
  const hydrate = useDatasetsStore((state) => state.hydrate);
  const datasets = useDatasetsStore((state) => state.datasets);
  const selectedId = useDatasetsStore((state) => state.selectedId);
  const addDataset = useDatasetsStore((state) => state.addDataset);
  const removeDataset = useDatasetsStore((state) => state.removeDataset);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<DatasetKind>("demo");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    addDataset(name, description, kind);
    setName("");
    setDescription("");
  };

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
              Datasets disponíveis no workspace de análises
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto px-30 py-6">
        <form
          onSubmit={handleAdd}
          className="mb-6 flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 sm:flex-row sm:items-end"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label
              htmlFor="dataset-name"
              className="text-xs font-medium text-muted-foreground"
            >
              Nome do dataset
            </label>
            <Input
              id="dataset-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Vendas por município"
            />
          </div>
          <div className="flex min-w-0 flex-[2] flex-col gap-1.5">
            <label
              htmlFor="dataset-description"
              className="text-xs font-medium text-muted-foreground"
            >
              Descrição (opcional)
            </label>
            <Input
              id="dataset-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="De onde vêm os dados e o que contêm"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5 sm:w-44">
            <label htmlFor="dataset-kind" className="text-xs font-medium text-muted-foreground">
              Tipo
            </label>
            <select
              id="dataset-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as DatasetKind)}
              className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {KIND_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={!name.trim()} className="h-9">
            <Plus aria-hidden />
            Adicionar
          </Button>
        </form>

        {!hydrated ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-2xl bg-muted/50"
              />
            ))}
          </div>
        ) : datasets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 px-6 py-20 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-muted/60 text-muted-foreground">
              <Database className="size-5" aria-hidden />
            </span>
            <p className="text-sm font-medium text-foreground">Nenhum dataset ainda</p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              Adicione um dataset acima para que ele apareça no dropdown do workspace de
              análises.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {datasets.map((dataset) => (
              <article
                key={dataset.id}
                className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/60 p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="min-w-0 truncate text-sm font-medium text-foreground">
                    {dataset.name}
                  </h2>
                  {dataset.id === selectedId && (
                    <span className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Em uso
                    </span>
                  )}
                </div>
                <p className="line-clamp-2 min-h-8 text-xs leading-relaxed text-muted-foreground">
                  {dataset.description || "Sem descrição."}
                </p>
                <span className="mt-1 w-fit rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {DATASET_KIND_LABELS[dataset.kind] ?? DATASET_KIND_LABELS.demo}
                </span>
                <div className="mt-auto flex justify-end pt-1">
                  <button
                    type="button"
                    aria-label={`Excluir ${dataset.name}`}
                    title="Excluir"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Excluir o dataset "${dataset.name}"? Esta ação não pode ser desfeita.`,
                        )
                      ) {
                        removeDataset(dataset.id);
                      }
                    }}
                    className="grid size-8 place-items-center rounded-md border border-border/70 text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
