"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { AssistantChatTransport, useAISDKChat, useChatRuntime } from "@assistant-ui/ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { Sparkles, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { Button } from "@/components/ui/button";
import { useDatasetsStore } from "@/lib/datasets/store";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { DashboardTools, setAgentTurn } from "./dashboard-tools";

const SUGGESTIONS = [
  "Monte um painel completo com os principais indicadores e gráficos destes dados.",
  "Adicione um filtro de período e um filtro por categoria no topo.",
  "Crie uma segunda página com a análise detalhada por categoria.",
];

/** Cada mensagem do usuário abre um novo passo de "desfazer" (as ferramentas do pedido ficam juntas). */
const TurnTracker = () => {
  const chat = useAISDKChat();
  const userMessages = chat?.messages.filter((message) => message.role === "user").length ?? 0;
  useEffect(() => setAgentTurn(userMessages), [userMessages]);
  return null;
};

const Welcome = () => {
  const chat = useAISDKChat();
  const ready = useDatasetsStore((state) => state.datasets.some((entry) => entry.kind === "dataset" && entry.status === "pronta"));
  const preview = useDashboardsStore((state) => state.preview);

  return (
    <div className="flex w-full flex-col gap-3 py-6 text-start">
      <p className="text-sm font-medium text-foreground">Peça o painel que você imagina</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Eu adiciono gráficos, indicadores, filtros e páginas enquanto você acompanha. Tudo vira um único passo de
        desfazer (Ctrl+Z) e só é salvo quando você salvar.
      </p>
      {!ready ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          Ainda não há datasets disponíveis. Crie ou publique um em Fontes de dados para eu usar.
        </p>
      ) : preview ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          O painel está em pré-visualização. Volte à edição para eu poder alterá-lo.
        </p>
      ) : (
        <ul className="flex flex-col items-start gap-2" aria-label="Sugestões">
          {SUGGESTIONS.map((prompt) => (
            <li key={prompt} className="max-w-full">
              <button
                type="button"
                disabled={!chat}
                onClick={() => void chat?.sendMessage({ text: prompt })}
                className="rounded-2xl bg-muted/70 px-3.5 py-2 text-start text-[13px] leading-snug text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-60"
              >
                {prompt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Chat do editor de dashboards: o assistente monta o painel aberto com as ferramentas do navegador. */
export const AgentPanel = ({ onClose }: { onClose: () => void }) => {
  const transport = useMemo(() => new AssistantChatTransport({ api: "/api/chat/dashboard" }), []);
  const runtime = useChatRuntime({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport,
  });

  return (
    <aside
      aria-label="Assistente de dashboards"
      className="flex w-96 max-w-[90vw] shrink-0 flex-col overflow-hidden border-l border-border/60 bg-card/40"
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border/60 px-3">
        <Sparkles className="size-4 text-primary" aria-hidden />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">Assistente</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fechar o assistente" title="Fechar">
          <X className="size-4" aria-hidden />
        </Button>
      </header>
      <div className="min-h-0 flex-1">
        <AssistantRuntimeProvider runtime={runtime}>
          <DashboardTools />
          <TurnTracker />
          <Thread components={{ Welcome }} autoFocus={false} />
        </AssistantRuntimeProvider>
      </div>
    </aside>
  );
};
