import { createGroq } from "@ai-sdk/groq";
import { frontendTools } from "@assistant-ui/ai-sdk";
import {
  type JSONSchema7,
  convertToModelMessages,
  generateId,
  isStepCount,
  streamText,
  type UIMessage,
} from "ai";
import { sanitizeMessages } from "@/lib/extract-file";
import { buildSystemPrompt, loadActiveSource, persistConversation, serverTools } from "@/lib/server/chat";
import { errorResponse, HttpError, requireUser } from "@/lib/server/http";
import { getProject } from "@/lib/server/projects";

export const maxDuration = 60;

const MODEL = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";

// Limite de saída por minuto (OTPM) da Groq neste plano é 1000 tokens;
// sem max_tokens a API estima a saída e rejeita a requisição ("Request too large").
const MAX_OUTPUT_TOKENS = Number(process.env.GROQ_MAX_OUTPUT_TOKENS) || 900;

// consulta → (correção) → visualização → resposta
const MAX_STEPS = 6;

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new HttpError(500, "GROQ_API_KEY não configurada. Adicione-a em .env.local.");

    const {
      messages,
      system,
      tools,
      projectId,
    }: {
      messages: UIMessage[];
      system?: string;
      tools?: Record<string, { description?: string; parameters: JSONSchema7 }>;
      projectId?: string;
    } = await req.json();

    if (!projectId) throw new HttpError(400, "projectId é obrigatório.");
    if (!Array.isArray(messages)) throw new HttpError(400, "messages inválido.");
    const project = await getProject(user.id, projectId);
    const source = await loadActiveSource(user.id, project.sourceId);

    const groq = createGroq({ apiKey });
    const aiSDKTools = {
      ...frontendTools(tools ?? {}),
      ...serverTools({ userId: user.id, projectId: project.id, source }),
    };
    const safeMessages = await sanitizeMessages(messages);

    const result = streamText({
      abortSignal: req.signal,
      model: groq(MODEL),
      messages: await convertToModelMessages(safeMessages, { tools: aiSDKTools }),
      system: [buildSystemPrompt(source), system].filter(Boolean).join("\n\n"),
      tools: aiSDKTools,
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
      onError: (error) => (error instanceof Error ? error.message : String(error)),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
