import { createGroq } from "@ai-sdk/groq";
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
import { sanitizeMessages } from "../extract-file";
import { errorResponse, HttpError, parseBody, requireUser } from "../http";
import { getProject } from "../projects";

const MODEL = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";

// Limite de saída por minuto (OTPM) da Groq neste plano é 1000 tokens;
// sem max_tokens a API estima a saída e rejeita a requisição ("Request too large").
const MAX_OUTPUT_TOKENS = Number(process.env.GROQ_MAX_OUTPUT_TOKENS) || 900;

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
  if (/rate.?limit|too large|429|quota/i.test(message)) {
    return "O serviço de IA atingiu o limite de uso. Tente novamente em instantes.";
  }
  return "Não foi possível gerar a resposta. Tente novamente.";
};

export const chatRoutes = new Hono();

chatRoutes.post("/", async (c) => {
  try {
    const req = c.req.raw;
    const user = await requireUser(req.headers);

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new HttpError(500, "GROQ_API_KEY não configurada no backend (.env).");

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

    const groq = createGroq({ apiKey });
    const aiTools = {
      ...frontendTools(tools ?? {}),
      ...serverTools({ userId: user.id, projectId: project.id, source }),
    };
    const safeMessages = await sanitizeMessages(messages);

    const result = streamText({
      abortSignal: req.signal,
      model: groq(MODEL),
      messages: await convertToModelMessages(safeMessages, { tools: aiTools }),
      system: [buildSystemPrompt(source), system].filter(Boolean).join("\n\n"),
      tools: aiTools,
      stopWhen: isStepCount(MAX_STEPS),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
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
