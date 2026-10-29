"use client";

import { useAISDKChat } from "@assistant-ui/ai-sdk";
import { ArrowUpRight, Code2, Database } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useCan } from "@/lib/auth-client";
import { DATASET_KIND_LABELS, useDatasetsStore } from "@/lib/datasets/store";
import { isWorkspaceSource } from "@/lib/domain/sources";
import { useNotebooksStore } from "@/lib/notebooks/store";
import { sourceSummary, suggestQuestions } from "@/lib/workspace/suggestions";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const SuggestedPrompts = ({ prompts }: { prompts: string[] }) => {
  const chat = useAISDKChat();

  return (
    <div className="grid w-full gap-2.5 sm:grid-cols-2">
      {prompts.map((prompt) => (
        <button
          key={prompt}
          type="button"
          disabled={!chat}
          onClick={() => void chat?.sendMessage({ text: prompt })}
          className={cn(
            "group flex items-start justify-between gap-3 rounded-xl border border-border bg-card/60 px-3.5 py-3 text-start",
            "text-sm leading-snug text-muted-foreground transition-colors",
            "hover:border-primary/40 hover:bg-card hover:text-foreground",
            "focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/40 outline-none",
            "disabled:opacity-60 disabled:pointer-events-none",
          )}
        >
          <span>{prompt}</span>
          <ArrowUpRight
            className="mt-0.5 size-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-primary"
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
};

/** Sem dataset no projeto: o primeiro passo é escolher um (ou, para o analista, criar). */
const PickSource = ({ notebookId }: { notebookId: string | null }) => {
  const datasets = useDatasetsStore((state) => state.datasets);
  const hydrated = useDatasetsStore((state) => state.hydrated);
  const setNotebookSource = useNotebooksStore((state) => state.setNotebookSource);
  const canManageSources = useCan("analista");
  const ready = datasets.filter(isWorkspaceSource);

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-dashed border-border bg-card/40 p-4 text-start">
      <p className="text-sm font-medium text-foreground">Escolha os dados para começar</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        O assistente responde com números dos datasets preparados pelos analistas. Selecione
        um para este projeto.
      </p>
      {hydrated && ready.length > 0 && notebookId ? (
        <ul className="flex flex-col gap-1.5">
          {ready.map((dataset) => (
            <li key={dataset.id}>
              <button
                type="button"
                onClick={() => setNotebookSource(notebookId, dataset.id)}
                className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-start text-sm text-foreground outline-none transition-colors hover:border-primary/40 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Database className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{dataset.name}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {DATASET_KIND_LABELS[dataset.kind]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {canManageSources ? (
        <Link
          href="/fontes-de-dados/editor"
          className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <Code2 className="size-3.5" aria-hidden />
          Criar um dataset no editor SQL
        </Link>
      ) : hydrated && ready.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Ainda não há datasets disponíveis. Peça a um analista para criar um.
        </p>
      ) : null}
    </div>
  );
};

export const WelcomeScreen = () => {
  const notebookId = useSearchParams().get("notebook");
  const sourceId = useNotebooksStore(
    (state) => state.notebooks.find((notebook) => notebook.id === notebookId)?.sourceId ?? null,
  );
  const hydrateDatasets = useDatasetsStore((state) => state.hydrate);
  const datasets = useDatasetsStore((state) => state.datasets);
  const source = datasets.find((dataset) => dataset.id === sourceId && isWorkspaceSource(dataset)) ?? null;

  useEffect(() => {
    hydrateDatasets();
  }, [hydrateDatasets]);

  const prompts = useMemo(() => (source ? suggestQuestions(source.tables) : []), [source]);

  return (
    <div className="flex w-full flex-col items-center gap-6 px-2 py-10 text-center sm:py-16">
      <Logo className="h-14 w-auto sm:h-16" />

      <div className="flex max-w-2xl flex-col gap-3">
        <h1 className="text-3xl font-medium tracking-tight text-balance text-foreground sm:text-4xl">
          Um notebook para analisar seus dados.
        </h1>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          {source
            ? "Pergunte ao agente ou escreva SQL: cada pergunta e cada consulta vira uma célula com o resultado."
            : "Escolha um dataset e combine o agente de IA com células SQL, como num notebook."}
        </p>
      </div>

      {source ? (
        <div className="flex w-full flex-col items-center gap-1.5">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-primary">
            <Database className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{source.name}</span>
          </span>
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
            {sourceSummary(source.tables)}
          </p>
        </div>
      ) : null}

      {source && prompts.length > 0 ? <SuggestedPrompts prompts={prompts} /> : null}
      {!source ? <PickSource notebookId={notebookId} /> : null}

      {source ? (
        <ul className="grid w-full max-w-xl gap-2 text-start text-xs text-muted-foreground sm:grid-cols-3">
          <li className="rounded-lg border border-border/70 px-3 py-2">
            <span className="mb-0.5 block font-medium text-foreground">✦ Agente</span>
            Pergunte em português; ele consulta e explica.
          </li>
          <li className="rounded-lg border border-border/70 px-3 py-2">
            <span className="mb-0.5 block font-mono font-medium text-foreground">SQL</span>
            Use “+ SQL” e Ctrl+Enter para executar.
          </li>
          <li className="rounded-lg border border-border/70 px-3 py-2">
            <span className="mb-0.5 block font-medium text-foreground">Estúdio</span>
            Salve tabelas e gráficos e monte dashboards.
          </li>
        </ul>
      ) : null}
    </div>
  );
};
