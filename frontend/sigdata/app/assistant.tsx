"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport, useAISDKChat } from "@assistant-ui/ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { AppShell } from "@/components/sigdata/app-shell";
import { WelcomeScreen } from "@/components/sigdata/welcome-screen";
import { DEFAULT_NOTEBOOK_TITLE, useNotebooksStore } from "@/lib/notebooks/store";

const NotebookBinder = ({ notebookId }: { notebookId: string | null }) => {
  const chat = useAISDKChat();
  const hydrated = useNotebooksStore((state) => state.hydrated);
  const hydrate = useNotebooksStore((state) => state.hydrate);
  const notebooks = useNotebooksStore((state) => state.notebooks);
  const touchNotebook = useNotebooksStore((state) => state.touchNotebook);
  const lastCount = useRef(0);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!notebookId || !hydrated) return;
    const messages = chat?.messages ?? [];
    if (messages.length === lastCount.current) return;
    lastCount.current = messages.length;
    if (messages.length === 0) return;

    const notebook = notebooks.find((entry) => entry.id === notebookId);
    if (!notebook) return;

    const patch: { title?: string } = {};
    if (notebook.title === DEFAULT_NOTEBOOK_TITLE) {
      const firstUser = messages.find((message) => message.role === "user");
      const text = firstUser?.parts
        ?.filter((part) => part.type === "text")
        .map((part) => part.text)
        .join(" ")
        .trim();
      if (text) patch.title = text.slice(0, 80);
    }
    touchNotebook(notebookId, Object.keys(patch).length > 0 ? patch : undefined);
  }, [chat, chat?.messages, notebookId, hydrated, notebooks, touchNotebook]);

  return null;
};

export const Assistant = () => {
  const searchParams = useSearchParams();
  const notebookId = searchParams.get("notebook");

  const runtime = useChatRuntime({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport: new AssistantChatTransport({
      api: "/api/chat",
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <NotebookBinder notebookId={notebookId} />
      <AppShell>
        <Thread components={{ Welcome: WelcomeScreen }} />
      </AppShell>
    </AssistantRuntimeProvider>
  );
};
