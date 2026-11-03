"use client";

import {
  AssistantRuntimeProvider,
  useAssistantInstructions,
  useAssistantTool,
  type AssistantToolProps,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { AssistantChatTransport, useAISDKChat, useChatRuntime } from "@assistant-ui/ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls, type JSONSchema7 } from "ai";
import { Check, Code2, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { buildAgentContext, restore, type Blobs, type Code } from "@/lib/dashboards/html-agent/code-context";
import { useHtmlRuntime } from "@/lib/dashboards/html-runtime";
import { isBindingReady, useBindingData } from "@/lib/dashboards/live-data";
import { useDashboardsStore } from "@/lib/dashboards/store";
import type { DataBinding } from "@/lib/dashboards/types";
import { HTML_CODE_MAX } from "@shared/dashboards/types";

/**
 * Agente de código do visual HTML: lê o código atual e os dados ligados, escreve HTML, CSS e JS
 * e aplica no elemento. A prévia ao vivo mostra o resultado; erros de execução voltam ao agente.
 */

/** Passo de "desfazer" do pedido atual (um por mensagem do usuário). */
let turnKey = "agente-html:0";

/** Quanto esperar o iframe recarregar e reportar erros antes de devolver o resultado ao agente. */
const SETTLE_MS = 1400;

type ApplyArgs = { html?: string; css?: string; js?: string };
type ApplyResult = { ok: true; resumo: string; erros: string[] } | { ok: false; error: string };

const ApplyChip = ({ args, result, status }: ToolCallMessagePartProps<ApplyArgs, ApplyResult>) => {
  const running = status?.type === "running" || status?.type === "requires-action";
  const failed = result?.ok === false || status?.type === "incomplete";
  const withErrors = result?.ok === true && result.erros.length > 0;
  const parts = ["html", "css", "js"].filter((key) => typeof (args as Record<string, unknown> | undefined)?.[key] === "string");
  return (
    <div className="my-1 flex max-w-full items-start gap-2 rounded-lg border border-border bg-card/60 px-2.5 py-1.5 text-xs">
      <span className="mt-0.5 shrink-0">
        {running ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
        ) : failed || withErrors ? (
          <TriangleAlert className="size-3.5 text-destructive" aria-hidden />
        ) : result ? (
          <Check className="size-3.5 text-primary" aria-hidden />
        ) : (
          <Code2 className="size-3.5 text-muted-foreground" aria-hidden />
        )}
      </span>
      <span className="min-w-0 break-words text-foreground">
        {result?.ok === false
          ? result.error
          : running
            ? `Escrevendo ${parts.map((part) => part.toUpperCase()).join(", ") || "o código"}…`
            : withErrors
              ? `Código aplicado, com erro: ${result.erros[0]}`
              : "Código aplicado"}
      </span>
    </div>
  );
};

const Tools = ({ elementId, blobs }: { elementId: string; blobs: React.MutableRefObject<Blobs> }) => {
  const tool = useMemo(
    () =>
      ({
        toolName: "aplicar_codigo",
        type: "frontend",
        description:
          "Aplica código ao visual. Informe só as partes que mudam (html, css, js); cada parte informada substitui a anterior " +
          "inteira, então devolva-a completa. Mantenha os marcadores @@LONGO…@@ exatamente como estão.",
        parameters: {
          type: "object",
          properties: { html: { type: "string" }, css: { type: "string" }, js: { type: "string" } },
        } satisfies JSONSchema7,
        execute: async (args): Promise<ApplyResult> => {
          const state = useDashboardsStore.getState();
          const element = state.current()?.elements.find((entry) => entry.id === elementId);
          if (!element || element.type !== "html") return { ok: false, error: "O visual não está mais no painel." };
          if (state.preview) return { ok: false, error: "O painel está em pré-visualização." };

          const next: Partial<Code> = {};
          for (const part of ["html", "css", "js"] as const) {
            const value = args[part];
            if (value === undefined) continue;
            if (typeof value !== "string") return { ok: false, error: `${part} deve ser texto.` };
            const full = restore(value, blobs.current);
            if (full.length > HTML_CODE_MAX) {
              return { ok: false, error: `${part.toUpperCase()} passou de ${HTML_CODE_MAX} caracteres: simplifique.` };
            }
            next[part] = full;
          }
          if (Object.keys(next).length === 0) return { ok: false, error: "Informe html, css ou js." };

          useHtmlRuntime.getState().clear(elementId);
          state.runAsOneStep(turnKey, () => state.updateProps(elementId, next, "agente-codigo"));
          // o iframe recarrega e reporta erros de execução: devolve-os para o agente se corrigir
          await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
          const erros = useHtmlRuntime.getState().errors[elementId] ?? [];
          return { ok: true, resumo: "Código aplicado", erros };
        },
        render: ApplyChip,
      }) satisfies AssistantToolProps<ApplyArgs, ApplyResult>,
    [elementId, blobs],
  );
  useAssistantTool(tool);
  return null;
};

/** Mantém o contexto (código atual, colunas, amostra, erros) como instrução do sistema. */
const Context = ({ elementId, blobs }: { elementId: string; blobs: React.MutableRefObject<Blobs> }) => {
  const element = useDashboardsStore((state) => state.current()?.elements.find((entry) => entry.id === elementId));
  const errors = useHtmlRuntime((state) => state.errors[elementId]);
  const binding = element?.type === "html" ? (element.props.binding as DataBinding | undefined) : undefined;
  const live = useBindingData(elementId, binding, { ignoreFilters: true });
  const data = isBindingReady(binding) && (live.status === "ready" || live.status === "loading") ? live.data : undefined;

  const { context, blobs: found } = useMemo(
    () =>
      buildAgentContext({
        code: element?.type === "html" ? { html: element.props.html, css: element.props.css, js: element.props.js } : { html: "", css: "", js: "" },
        columns: data?.columns.map((column) => ({ name: column.name, kind: column.kind })) ?? [],
        sample: data?.rows.slice(0, 3) ?? [],
        errors: errors ?? [],
      }),
    [element, data, errors],
  );
  blobs.current = found;
  useAssistantInstructions(context);
  return null;
};

const SUGGESTIONS = [
  "Faça barras horizontais animadas com a primeira medida por categoria.",
  "Crie cartões com o valor de cada categoria e contagem animada.",
  "Faça um gráfico de rosca com legenda e tooltip.",
];

const Welcome = () => {
  const chat = useAISDKChat();
  return (
    <div className="flex w-full flex-col gap-3 py-6 text-start">
      <p className="text-sm font-medium text-foreground">Descreva o visual</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Eu escrevo o HTML, o CSS e o JavaScript, leio as colunas ligadas e corrijo os erros que aparecerem. Peça ajustes
        em cima do resultado: cores, animação, interação.
      </p>
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
    </div>
  );
};

/** Cada mensagem do usuário abre um novo passo de "desfazer". */
const TurnTracker = () => {
  const chat = useAISDKChat();
  const userMessages = chat?.messages.filter((message) => message.role === "user").length ?? 0;
  useEffect(() => {
    turnKey = `agente-html:${userMessages}`;
  }, [userMessages]);
  return null;
};

export const HtmlAgentPanel = ({ elementId }: { elementId: string }) => {
  const blobs = useRef<Blobs>({});
  const transport = useMemo(() => new AssistantChatTransport({ api: "/api/chat/html" }), []);
  const runtime = useChatRuntime({ sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls, transport });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Tools elementId={elementId} blobs={blobs} />
      <Context elementId={elementId} blobs={blobs} />
      <TurnTracker />
      <Thread components={{ Welcome }} autoFocus={false} />
    </AssistantRuntimeProvider>
  );
};
