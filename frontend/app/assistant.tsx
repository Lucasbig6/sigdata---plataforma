"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport, useAISDKChat } from "@assistant-ui/ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai";
import { Loader2 } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { AppShell } from "@/components/sigdata/app-shell";
import { VisualizationTools } from "@/components/sigdata/create-visualization-tool";
import { PanelTools } from "@/components/sigdata/panel-tools";
import { WelcomeScreen } from "@/components/sigdata/welcome-screen";
import { CellsAfterMessage, ComposerSqlButton, OrphanCells } from "@/components/workspace/notebook/cell-slots";
import { QueryNodeTool } from "@/components/workspace/notebook/query-node";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/lib/chat/store";
import { DEFAULT_NOTEBOOK_TITLE, useNotebooksStore } from "@/lib/notebooks/store";

/** Dá ao projeto o título da primeira pergunta. As mensagens são salvas pelo servidor. */
const NotebookTitleBinder = ({ notebookId }: { notebookId: string }) => {
  const chat = useAISDKChat();
  const notebooks = useNotebooksStore((state) => state.notebooks);
  const touchNotebook = useNotebooksStore((state) => state.touchNotebook);
  const lastCount = useRef(0);

  useEffect(() => {
    const messages = chat?.messages ?? [];
    if (messages.length === 0 || messages.length === lastCount.current) return;
    lastCount.current = messages.length;

    const notebook = notebooks.find((entry) => entry.id === notebookId);
    if (!notebook) return;

    if (notebook.title === DEFAULT_NOTEBOOK_TITLE) {
      const firstUser = messages.find((message) => message.role === "user");
      const text = firstUser?.parts
        ?.filter((part) => "text" in part && part.type === "text")
        .map((part) => ("text" in part ? part.text : ""))
        .join(" ")
        .trim();
      if (text) touchNotebook(notebookId, { title: text.slice(0, 80) });
      return;
    }
    touchNotebook(notebookId);
  }, [chat, chat?.messages, notebookId, notebooks, touchNotebook]);

  return null;
};

const AssistantRuntimeInner = ({
  notebookId,
  initialMessages,
}: {
  notebookId: string;
  initialMessages: UIMessage[];
}) => {
  const notebooks = useNotebooksStore((state) => state.notebooks);
  const hasSource = Boolean(notebooks.find((entry) => entry.id === notebookId)?.sourceId);

  const transport = useMemo(
    () => new AssistantChatTransport({ api: "/api/chat", body: { projectId: notebookId } }),
    [notebookId],
  );
  const suggestions = useMemo(() => followupsFor(hasSource), [hasSource]);

  const runtime = useChatRuntime({
    messages: initialMessages,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    suggestions,
    transport,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <VisualizationTools />
      <QueryNodeTool />
      <PanelTools />
      <NotebookTitleBinder notebookId={notebookId} />
      <AppShell>
        <Thread components={NOTEBOOK_COMPONENTS} />
      </AppShell>
    </AssistantRuntimeProvider>
  );
};

const EMPTY_MESSAGES: UIMessage[] = [];

/** O chat vira notebook: células SQL entre as mensagens e "+ SQL" no rodapé. */
const NOTEBOOK_COMPONENTS = {
  Welcome: WelcomeScreen,
  MessageAppendix: CellsAfterMessage,
  ThreadAppendix: OrphanCells,
  ComposerExtra: ComposerSqlButton,
};

/** Follow-ups oferecidos após cada resposta, conforme o projeto tem (ou não) fonte. */
const followupsFor = (hasSource: boolean) =>
  (hasSource
    ? [
        "Compare os dois melhores e os dois piores.",
        "Mostre a evolução mês a mês.",
        "Que valores fogem do padrão?",
        "Salve isso como gráfico no painel.",
      ]
    : [
        "Resuma os principais pontos.",
        "Sugira três perguntas de aprofundamento.",
        "Que dado eu deveria conectar para ir além?",
      ]
  ).map((prompt) => ({ prompt }));

/** Carrega o histórico do servidor antes de montar o runtime do chat. */
const NotebookLoader = ({ notebookId }: { notebookId: string }) => {
  const load = useChatStore((state) => state.load);
  const loadState = useChatStore((state) => state.loadState[notebookId]);
  const messages = useChatStore((state) => state.messagesByNotebook[notebookId]) ?? EMPTY_MESSAGES;

  useEffect(() => {
    void load(notebookId);
  }, [load, notebookId]);

  if (loadState?.status === "error") {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm font-medium text-foreground">Não foi possível abrir a conversa</p>
        <p className="max-w-sm text-xs text-muted-foreground">{loadState.error}</p>
        <Button size="sm" variant="outline" onClick={() => void load(notebookId)}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (loadState?.status !== "ready") {
    return (
      <div className="flex h-dvh items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Carregando conversa…
      </div>
    );
  }

  return <AssistantRuntimeInner notebookId={notebookId} initialMessages={messages} />;
};

export const Assistant = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const notebookId = searchParams.get("notebook");
  const hydrated = useNotebooksStore((state) => state.hydrated);
  const hydrate = useNotebooksStore((state) => state.hydrate);
  const loadError = useNotebooksStore((state) => state.error);
  const createNotebook = useNotebooksStore((state) => state.createNotebook);
  const autoCreated = useRef(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || notebookId || autoCreated.current) return;
    autoCreated.current = true;
    const id = createNotebook();
    router.replace(`/workspace?notebook=${id}`);
  }, [hydrated, notebookId, createNotebook, router]);

  if (!notebookId) {
    if (loadError) {
      return (
        <div className="flex h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm font-medium text-foreground">Não foi possível abrir o workspace</p>
          <p className="max-w-sm text-xs text-muted-foreground">{loadError}</p>
          <Button size="sm" variant="outline" onClick={hydrate}>
            Tentar novamente
          </Button>
        </div>
      );
    }
    return (
      <div className="flex h-dvh items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Preparando o projeto…
      </div>
    );
  }

  return <NotebookLoader key={notebookId} notebookId={notebookId} />;
};
