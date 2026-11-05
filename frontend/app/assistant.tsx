"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport, useAISDKChat } from "@assistant-ui/ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { projectHref } from "@/lib/routes";
import { useEffect, useMemo, useRef } from "react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { AppShell } from "@/components/sigdata/app-shell";
import { VisualizationTools } from "@/components/sigdata/create-visualization-tool";
import { PanelTools } from "@/components/sigdata/panel-tools";
import { WelcomeScreen } from "@/components/sigdata/welcome-screen";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/lib/chat/store";
import { titleFromQuestion } from "@shared/notebook";
import { DEFAULT_NOTEBOOK_TITLE, useNotebooksStore } from "@/lib/notebooks/store";

/** A primeira pergunta dá título à conversa (e ao projeto, se ainda sem nome). As mensagens são salvas pelo servidor. */
const ChatTitleBinder = ({ notebookId, chatId }: { notebookId: string; chatId: string }) => {
  const chat = useAISDKChat();
  const touchChat = useChatStore((state) => state.touchChat);
  const touchNotebook = useNotebooksStore((state) => state.touchNotebook);
  const lastCount = useRef(0);

  useEffect(() => {
    const messages = chat?.messages ?? [];
    if (messages.length === 0 || messages.length === lastCount.current) return;
    lastCount.current = messages.length;

    const firstUser = messages.find((message) => message.role === "user");
    const text = firstUser?.parts
      ?.filter((part) => "text" in part && part.type === "text")
      .map((part) => ("text" in part ? part.text : ""))
      .join(" ");
    const title = text ? titleFromQuestion(text) : "";

    touchChat(notebookId, chatId, title || undefined);
    const notebook = useNotebooksStore.getState().notebooks.find((entry) => entry.id === notebookId);
    touchNotebook(notebookId, notebook?.title === DEFAULT_NOTEBOOK_TITLE && title ? { title } : undefined);
  }, [chat, chat?.messages, notebookId, chatId, touchChat, touchNotebook]);

  return null;
};

const AssistantRuntimeInner = ({
  notebookId,
  chatId,
  initialMessages,
}: {
  notebookId: string;
  chatId: string;
  initialMessages: UIMessage[];
}) => {
  const transport = useMemo(
    () => new AssistantChatTransport({ api: "/api/chat", body: { projectId: notebookId, chatId } }),
    [notebookId, chatId],
  );

  const runtime = useChatRuntime({
    messages: initialMessages,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <VisualizationTools />
      <PanelTools />
      <ChatTitleBinder notebookId={notebookId} chatId={chatId} />
      <AppShell>
        <Thread components={{ Welcome: WelcomeScreen }} />
      </AppShell>
    </AssistantRuntimeProvider>
  );
};

const EMPTY_MESSAGES: UIMessage[] = [];

/** Carrega o histórico da conversa antes de montar o runtime do chat. */
const ChatLoader = ({ notebookId, chatId }: { notebookId: string; chatId: string }) => {
  const load = useChatStore((state) => state.loadMessages);
  const forget = useChatStore((state) => state.forgetMessages);
  const loadState = useChatStore((state) => state.messagesState[chatId]);
  const messages = useChatStore((state) => state.messagesByChat[chatId]) ?? EMPTY_MESSAGES;

  useEffect(() => {
    void load(notebookId, chatId);
    // ao sair da conversa o cache some: voltar a ela traz o histórico que o servidor gravou
    return () => forget(chatId);
  }, [load, forget, notebookId, chatId]);

  if (loadState?.status === "error") {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm font-medium text-foreground">Não foi possível abrir a conversa</p>
        <p className="max-w-sm text-xs text-muted-foreground">{loadState.error}</p>
        <Button size="sm" variant="outline" onClick={() => void load(notebookId, chatId)}>
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

  return <AssistantRuntimeInner notebookId={notebookId} chatId={chatId} initialMessages={messages} />;
};

const Preparing = ({ children }: { children: string }) => (
  <div className="flex h-dvh items-center justify-center gap-2 text-sm text-muted-foreground">
    <Loader2 className="size-4 animate-spin" aria-hidden />
    {children}
  </div>
);

const LoadFailure = ({ title, error, onRetry }: { title: string; error: string; onRetry: () => void }) => (
  <div className="flex h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
    <p className="text-sm font-medium text-foreground">{title}</p>
    <p className="max-w-sm text-xs text-muted-foreground">{error}</p>
    <Button size="sm" variant="outline" onClick={onRetry}>
      Tentar novamente
    </Button>
  </div>
);

/** Escolhe a conversa do projeto: a do endereço (`?c=`), senão a mais recente, senão uma nova. Nunca cria projeto. */
const ProjectChat = ({ notebookId }: { notebookId: string }) => {
  const router = useRouter();
  const requested = useSearchParams().get("c");
  const loadChats = useChatStore((state) => state.loadChats);
  const createChat = useChatStore((state) => state.createChat);
  const chatsState = useChatStore((state) => state.chatsState[notebookId]);
  const chats = useChatStore((state) => state.chatsByProject[notebookId]);

  useEffect(() => {
    if (!useChatStore.getState().chatsState[notebookId]) void loadChats(notebookId);
  }, [loadChats, notebookId]);

  const ready = chatsState?.status === "ready";
  // conversa do endereço que existe no projeto; qualquer outra (apagada, de outro projeto) cai na mais recente
  const chatId = ready ? (chats?.find((chat) => chat.id === requested)?.id ?? null) : null;

  useEffect(() => {
    if (!ready || chatId) return;
    router.replace(projectHref(notebookId, chats?.[0]?.id ?? createChat(notebookId)));
  }, [ready, chatId, chats, createChat, notebookId, router]);

  if (chatsState?.status === "error") {
    return <LoadFailure title="Não foi possível abrir o projeto" error={chatsState.error} onRetry={() => void loadChats(notebookId)} />;
  }
  if (!chatId) return <Preparing>Carregando conversas…</Preparing>;
  return <ChatLoader key={chatId} notebookId={notebookId} chatId={chatId} />;
};

/** Sem projeto no endereço, abre o mais recente. Só cria um projeto quando a pessoa ainda não tem nenhum. */
const OpenLatestProject = () => {
  const router = useRouter();
  const hydrated = useNotebooksStore((state) => state.hydrated);
  const hydrate = useNotebooksStore((state) => state.hydrate);
  const loadError = useNotebooksStore((state) => state.error);
  const createNotebook = useNotebooksStore((state) => state.createNotebook);
  const opened = useRef(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || loadError || opened.current) return;
    opened.current = true;
    const [latest] = useNotebooksStore.getState().notebooks;
    router.replace(projectHref(latest ? latest.id : createNotebook()));
  }, [hydrated, loadError, createNotebook, router]);

  if (loadError) return <LoadFailure title="Não foi possível abrir o workspace" error={loadError} onRetry={hydrate} />;
  return <Preparing>Preparando o projeto…</Preparing>;
};

export const Assistant = ({ notebookId = null }: { notebookId?: string | null }) =>
  notebookId ? <ProjectChat key={notebookId} notebookId={notebookId} /> : <OpenLatestProject />;
