import { createGroq } from "@ai-sdk/groq";
import { frontendTools } from "@assistant-ui/ai-sdk";
import { type JSONSchema7, streamText, convertToModelMessages, type UIMessage } from "ai";
import { sanitizeMessages } from "@/lib/extract-file";

export const maxDuration = 60;

const MODEL = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";

// Limite de saída por minuto (OTPM) da Groq neste plano é 1000 tokens;
// sem max_tokens a API estima a saída e rejeita a requisição ("Request too large").
const MAX_OUTPUT_TOKENS = Number(process.env.GROQ_MAX_OUTPUT_TOKENS) || 900;

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "GROQ_API_KEY não configurada. Adicione-a em .env.local." },
      { status: 500 },
    );
  }

  const {
    messages,
    system,
    tools,
  }: {
    messages: UIMessage[];
    system?: string;
    tools?: Record<string, { description?: string; parameters: JSONSchema7 }>;
  } = await req.json();

  const groq = createGroq({ apiKey });
  const aiSDKTools = { ...frontendTools(tools ?? {}) };
  const safeMessages = await sanitizeMessages(messages);
  const result = streamText({
    abortSignal: req.signal,
    model: groq(MODEL),
    messages: await convertToModelMessages(safeMessages, { tools: aiSDKTools }),
    system,
    tools: aiSDKTools,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    maxRetries: 1,
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    onError: (error) => (error instanceof Error ? error.message : String(error)),
  });
}
