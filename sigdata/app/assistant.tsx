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
import { WelcomeScreen } from "@/components/sigdata/welcome-screen";
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
  const transport = useMemo(
    () => new AssistantChatTransport({ api: "/api/chat", body: { projectId: notebookId } }),
    [notebookId],
  );

  const runtime = useChatRuntime({
    messages: initialMessages,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <VisualizationTools />
      <NotebookTitleBinder notebookId={notebookId} />
      <AppShell>
        <Thread components={{ Welcome: WelcomeScreen }} />
      </AppShell>
    </AssistantRuntimeProvider>
  );
};

const EMPTY_MESSAGES: UIMessage[] = [];

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

  if (!notebookId) return null;

  return <NotebookLoader key={notebookId} notebookId={notebookId} />;
};
