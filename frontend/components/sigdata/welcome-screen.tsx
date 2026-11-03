"use client";

import { useAISDKChat } from "@assistant-ui/ai-sdk";
import { Database, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRole, useSession } from "@/lib/auth-client";
import { canManageData } from "@shared/roles";
import { DATASET_KIND_LABELS, isAnalysisDataset, useDatasetsStore } from "@/lib/datasets/store";
import { useNotebooksStore } from "@/lib/notebooks/store";
import { sourceSummary, suggestQuestions } from "@/lib/workspace/suggestions";
import { useActiveSource } from "@/lib/workspace/use-active-source";
import { cn } from "@/lib/utils";
import { useNotebookId } from "@/lib/use-notebook-id";

const SuggestedPrompts = ({ prompts }: { prompts: string[] }) => {
  const chat = useAISDKChat();

  return (
    <ul className="flex w-full flex-col items-start gap-2" aria-label="Sugestões de perguntas">
      {prompts.map((prompt) => (
        <li key={prompt} className="max-w-full">
          <button
            type="button"
            disabled={!chat}
            onClick={() => void chat?.sendMessage({ text: prompt })}
            className={cn(
              "rounded-2xl bg-muted/70 px-4 py-2.5 text-start text-sm leading-snug text-foreground transition-colors",
              "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 outline-none",
              "disabled:opacity-60 disabled:pointer-events-none",
            )}
          >
            {prompt}
          </button>
        </li>
      ))}
    </ul>
  );
};

/** Sem fonte no projeto: o primeiro passo é escolher (ou enviar) os dados. */
const PickSource = ({ notebookId }: { notebookId: string | null }) => {
  const datasets = useDatasetsStore((state) => state.datasets);
  const hydrated = useDatasetsStore((state) => state.hydrated);
  const setNotebookSource = useNotebooksStore((state) => state.setNotebookSource);
  const ready = datasets.filter(isAnalysisDataset);
  const canManage = canManageData(useRole() ?? "usuario");

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-dashed border-border bg-card/40 p-4 text-start">
      <p className="text-sm font-medium text-foreground">Escolha os dados para começar</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        O assistente só responde com números dos datasets preparados pelos analistas. Selecione um
        para este projeto.
      </p>
      {hydrated && ready.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {canManage
            ? "Ainda não há datasets. Crie um no editor SQL a partir de uma fonte."
            : "Ainda não há datasets publicados. Peça a um analista para publicar um."}
        </p>
      ) : null}
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
      {canManage ? (
        <Link
          href="/fontes-de-dados"
          className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <Upload className="size-3.5" aria-hidden />
          Gerenciar fontes e datasets
        </Link>
      ) : null}
    </div>
  );
};

export const WelcomeScreen = () => {
  const notebookId = useNotebookId();
  const source = useActiveSource();

  const prompts = useMemo(() => (source ? suggestQuestions(source.tables) : []), [source]);

  const firstName = useSession().data?.user.name.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-5 px-4 py-10 text-start sm:py-14">
      <h1 className="text-3xl font-light tracking-tight text-balance text-foreground sm:text-4xl">
        {firstName ? `Olá, ${firstName}.` : "Olá."}{" "}
        <span className="text-muted-foreground">
          {source ? "O que você quer saber?" : "Escolha um dataset para começar."}
        </span>
      </h1>
      {source ? (
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          <Database className="mr-1.5 inline size-3.5 align-[-2px] text-primary" aria-hidden />
          Analisando <span className="font-medium text-foreground">{source.name}</span> · {sourceSummary(source.tables)}
        </p>
      ) : null}

      {source && prompts.length > 0 ? (
        <div className="flex w-full flex-col gap-2.5">
          <p className="text-sm font-medium text-foreground">Por onde começar?</p>
          <SuggestedPrompts prompts={prompts} />
        </div>
      ) : null}
      {!source ? <PickSource notebookId={notebookId} /> : null}
    </div>
  );
};
