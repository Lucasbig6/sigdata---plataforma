"use client";

import { useAISDKChat } from "@assistant-ui/ai-sdk";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const SUGGESTIONS = [
  "Analise os principais indicadores desta base.",
  "Identifique tendências ao longo do tempo.",
  "Compare o desempenho entre municípios.",
  "Quais são os principais pontos de atenção?",
] as const;

const SuggestedPrompts = () => {
  const chat = useAISDKChat();

  return (
    <div className="grid w-full gap-2.5 sm:grid-cols-2">
      {SUGGESTIONS.map((prompt) => (
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

export const WelcomeScreen = () => (
  <div className="flex w-full flex-col items-center gap-6 px-2 py-10 text-center sm:py-16">
    <Logo className="h-14 w-auto sm:h-16" />

    <div className="flex max-w-2xl flex-col gap-3">
      <h1 className="text-3xl font-medium tracking-tight text-balance text-foreground sm:text-4xl">
        Inteligência de dados, em uma conversa.
      </h1>
      <p className="text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
        Explore seus dados, encontre padrões e transforme perguntas em análises.
      </p>
    </div>

    <SuggestedPrompts />

    <p className="text-xs text-muted-foreground/70">
      O painel lateral exibe visualizações de demonstração.
    </p>
  </div>
);
