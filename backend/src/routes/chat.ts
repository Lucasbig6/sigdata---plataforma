import { resolveChatModel } from "../ai-model";
import {
  convertToModelMessages,
  generateId,
  isStepCount,
  jsonSchema,
  streamText,
  tool,
  type JSONSchema7,
  type ToolSet,
  type UIMessage,
} from "ai";
import { Hono } from "hono";
import { z } from "zod";
import { userLimiter } from "../rate-limit";
import { buildSystemPrompt, loadActiveSource, persistConversation, serverTools } from "../chat";
import { withUserContext } from "../chat-context";
import { sanitizeMessages } from "../extract-file";
import { errorResponse, HttpError, parseBody, requireUser } from "../http";
import { getProject } from "../projects";
import { canManageData } from "@shared/roles";
import { HTML_AGENT_PROMPT } from "../html-agent";
import { buildDashboardPrompt, dashboardServerTools, dashboardSources } from "../dashboard-chat";

// consulta → (correção) → visualização/edição → resposta
const MAX_STEPS = 8;

type FrontendToolDefs = Record<string, { description?: string; parameters: JSONSchema7 }>;

/**
 * Ferramentas registradas no navegador (Assistant UI, ex.: create_visualization):
 * o modelo pode chamá-las, mas a execução acontece no cliente (sem `execute`).
 */
const frontendTools = (defs: FrontendToolDefs): ToolSet =>
  Object.fromEntries(
    Object.entries(defs).map(([name, def]) => [
      name,
      tool({ description: def.description, inputSchema: jsonSchema(def.parameters) }),
    ]),
  );

/** Corpo da requisição: limites evitam abuso de cota e payloads gigantes. */
const chatBodySchema = z.object({
  projectId: z.string().min(1).max(64),
  messages: z.array(z.custom<UIMessage>((value) => typeof value === "object" && value !== null)).min(1).max(100),
  system: z.string().max(4000).optional(),
  tools: z
    .record(
      z.string().max(64),
      z.object({ description: z.string().max(2000).optional(), parameters: z.custom<JSONSchema7>() }),
    )
    .refine((tools) => Object.keys(tools).length <= 20, "Ferramentas demais.")
    .optional(),
});

const chatLimit = userLimiter({
  windowMs: 60_000,
  max: Number(process.env.CHAT_RATE_LIMIT_PER_MIN) || 20,
});

/** Mensagem segura para o navegador; o detalhe fica só no log do servidor. */
const publicChatError = (error: unknown) => {
  console.error("[sigdata] erro no chat", error);
  const message = error instanceof Error ? error.message : String(error);
  if (/credit balance|insufficient.?(funds|credit)|billing/i.test(message)) {
    return "A conta do serviço de IA está sem crédito. Avise um administrador.";
  }
  if (/rate.?limit|too large|429|quota|overloaded|529/i.test(message)) {
    return "O serviço de IA atingiu o limite de uso. Tente novamente em instantes.";
  }
  return "Não foi possível gerar a resposta. Tente novamente.";
};

/** Montar um dashboard pede mais passos (um por elemento) do que uma pergunta de análise. */
const DASHBOARD_MAX_STEPS = 16;

/** Corpo do chat do editor de dashboards: o estado do painel fica no navegador (ferramentas ler_dashboard etc.). */
const dashboardChatSchema = z.object({
  messages: z.array(z.custom<UIMessage>((value) => typeof value === "object" && value !== null)).min(1).max(60),
  system: z.string().max(4000).optional(),
  tools: chatBodySchema.shape.tools,
});

/** O código de um visual é uma resposta longa de uma vez: precisa de mais saída que o chat de análise. */
const htmlOutputTokens = (base: number) => Math.max(base, Number(process.env.HTML_AGENT_MAX_OUTPUT_TOKENS) || 3500);

/** Contexto do visual (código atual elidido, colunas, amostra): vem do navegador como `system`. */
const HTML_CONTEXT_MAX = 14_000;

const htmlChatSchema = z.object({
  messages: dashboardChatSchema.shape.messages,
  system: z.string().max(HTML_CONTEXT_MAX).optional(),
  tools: chatBodySchema.shape.tools,
});

export const chatRoutes = new Hono();

/** Agente que escreve o código do visual HTML personalizado (só analistas e admins: são eles que editam o código). */
chatRoutes.post("/html", async (c) => {
  try {
    const req = c.req.raw;
    const user = await requireUser(req.headers);
    if (!canManageData(user.role)) throw new HttpError(403, "Só analistas e administradores editam o código do visual.");
    const chatModel = resolveChatModel();

    const retryAfter = chatLimit(user.id);
    if (retryAfter !== null) {
      c.header("Retry-After", String(retryAfter));
      throw new HttpError(429, `Muitas mensagens em pouco tempo. Aguarde ${retryAfter}s.`);
    }

    const { messages, system, tools } = (await parseBody(req, htmlChatSchema)) as {
      messages: UIMessage[];
      system?: string;
      tools?: FrontendToolDefs;
    };
    // só a ferramenta que aplica o código: o agente não ganha outro poder sobre o painel
    const allowed = Object.fromEntries(Object.entries(tools ?? {}).filter(([name]) => name === "aplicar_codigo"));
    const aiTools = frontendTools(allowed);

    const result = streamText({
      abortSignal: req.signal,
      model: chatModel.model,
      messages: await convertToModelMessages(await sanitizeMessages(messages), { tools: aiTools }),
      system: [HTML_AGENT_PROMPT, system].filter(Boolean).join("\n\n"),
      tools: aiTools,
      stopWhen: isStepCount(4),
      maxOutputTokens: htmlOutputTokens(chatModel.maxOutputTokens),
      maxRetries: 1,
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      generateMessageId: generateId,
      sendReasoning: false,
      onError: publicChatError,
    });
  } catch (error) {
    return errorResponse(error);
  }
});

/** Assistente que monta o dashboard aberto: mesmas regras de acesso às fontes do editor; nada é gravado aqui. */
chatRoutes.post("/dashboard", async (c) => {
  try {
    const req = c.req.raw;
    const user = await requireUser(req.headers);
    const chatModel = resolveChatModel();

    const retryAfter = chatLimit(user.id);
    if (retryAfter !== null) {
      c.header("Retry-After", String(retryAfter));
      throw new HttpError(429, `Muitas mensagens em pouco tempo. Aguarde ${retryAfter}s.`);
    }

    const { messages, tools } = (await parseBody(req, dashboardChatSchema)) as {
      messages: UIMessage[];
      tools?: FrontendToolDefs;
    };

    const actor = { id: user.id, role: user.role };
    const sources = await dashboardSources(actor);
    const aiTools = {
      ...frontendTools(tools ?? {}),
      ...dashboardServerTools({ actor, allowed: new Set(sources.map((source) => source.id)) }),
    };
    const safeMessages = withUserContext(await sanitizeMessages(messages));

    const result = streamText({
      abortSignal: req.signal,
      model: chatModel.model,
      messages: await convertToModelMessages(safeMessages, { tools: aiTools }),
      system: buildDashboardPrompt(sources),
      tools: aiTools,
      stopWhen: isStepCount(DASHBOARD_MAX_STEPS),
      maxOutputTokens: chatModel.maxOutputTokens,
      maxRetries: 1,
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      generateMessageId: generateId,
      sendReasoning: false,
      onError: publicChatError,
    });
  } catch (error) {
    return errorResponse(error);
  }
});

chatRoutes.post("/", async (c) => {
  try {
    const req = c.req.raw;
    const user = await requireUser(req.headers);

    const chatModel = resolveChatModel();

    const retryAfter = chatLimit(user.id);
    if (retryAfter !== null) {
      c.header("Retry-After", String(retryAfter));
      throw new HttpError(429, `Muitas mensagens em pouco tempo. Aguarde ${retryAfter}s.`);
    }

    const { messages, system, tools, projectId } = (await parseBody(req, chatBodySchema)) as {
      messages: UIMessage[];
      system?: string;
      tools?: FrontendToolDefs;
      projectId: string;
    };

    const project = await getProject(user.id, projectId);
    const source = await loadActiveSource(user.id, project.sourceId);

    const aiTools = {
      ...frontendTools(tools ?? {}),
      ...serverTools({ userId: user.id, projectId: project.id, source }),
    };
    const safeMessages = withUserContext(await sanitizeMessages(messages));

    const result = streamText({
      abortSignal: req.signal,
      model: chatModel.model,
      messages: await convertToModelMessages(safeMessages, { tools: aiTools }),
      system: [buildSystemPrompt(source), system].filter(Boolean).join("\n\n"),
      tools: aiTools,
      stopWhen: isStepCount(MAX_STEPS),
      maxOutputTokens: chatModel.maxOutputTokens,
      maxRetries: 1,
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      generateMessageId: generateId,
      sendReasoning: true,
      onEnd: async ({ messages: finalMessages }) => {
        try {
          await persistConversation(project.id, finalMessages);
        } catch (error) {
          console.error("[sigdata] falha ao salvar conversa", error);
        }
      },
      onError: publicChatError,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
