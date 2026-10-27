"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport, useAISDKChat } from "@assistant-ui/ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { AppShell } from "@/components/sigdata/app-shell";
import { VisualizationTools } from "@/components/sigdata/create-visualization-tool";
import { WelcomeScreen } from "@/components/sigdata/welcome-screen";
import { useChatStore } from "@/lib/chat/store";
import { DEFAULT_NOTEBOOK_TITLE, useNotebooksStore } from "@/lib/notebooks/store";
import { usePanelStore } from "@/lib/panel/store";

const NotebookBinder = ({ notebookId }: { notebookId: string | null }) => {
  const chat = useAISDKChat();
  const hydrated = useNotebooksStore((state) => state.hydrated);
  const hydrate = useNotebooksStore((state) => state.hydrate);
  const notebooks = useNotebooksStore((state) => state.notebooks);
  const touchNotebook = useNotebooksStore((state) => state.touchNotebook);
  const saveMessages = useChatStore((state) => state.saveMessages);
  const lastCount = useRef(0);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!notebookId || !hydrated) return;
    const messages = chat?.messages ?? [];
    if (messages.length === 0) return;

    saveMessages(notebookId, messages);

    if (messages.length === lastCount.current) return;
    lastCount.current = messages.length;

    const notebook = notebooks.find((entry) => entry.id === notebookId);
    if (!notebook) return;

    const patch: { title?: string } = {};
    if (notebook.title === DEFAULT_NOTEBOOK_TITLE) {
      const firstUser = messages.find((message) => message.role === "user");
      const text = firstUser?.parts
        ?.filter((part) => "text" in part && part.type === "text")
        .map((part) => ("text" in part ? part.text : ""))
        .join(" ")
        .trim();
      if (text) patch.title = text.slice(0, 80);
    }
    touchNotebook(notebookId, Object.keys(patch).length > 0 ? patch : undefined);
  }, [chat, chat?.messages, notebookId, hydrated, notebooks, touchNotebook, saveMessages]);

  return null;
};

const EMPTY_MESSAGES: never[] = [];

const AssistantRuntimeInner = ({ notebookId }: { notebookId: string }) => {
  const hydratedChat = useChatStore((state) => state.hydrated);
  const hydrateChat = useChatStore((state) => state.hydrate);
  const hydratePanel = usePanelStore((state) => state.hydrate);
  const messagesByNotebook = useChatStore((state) => state.messagesByNotebook);
  const initialMessages = messagesByNotebook[notebookId] ?? EMPTY_MESSAGES;

  useEffect(() => {
    hydrateChat();
    hydratePanel();
  }, [hydrateChat, hydratePanel]);

  const runtime = useChatRuntime({
    messages: hydratedChat ? initialMessages : [],
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport: new AssistantChatTransport({
      api: "/api/chat",
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <VisualizationTools />
      <NotebookBinder notebookId={notebookId} />
      <AppShell>
        <Thread components={{ Welcome: WelcomeScreen }} />
      </AppShell>
    </AssistantRuntimeProvider>
  );
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

  return <AssistantRuntimeInner key={notebookId} notebookId={notebookId} />;
};
