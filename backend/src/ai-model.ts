import { createAnthropic } from "@ai-sdk/anthropic";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { HttpError } from "./http";

/**
 * Modelo do chat. Escolha com AI_PROVIDER:
 * - anthropic: Claude (ANTHROPIC_API_KEY)
 * - groq: Groq (GROQ_API_KEY)
 * - openrouter: OpenRouter (OPENROUTER_API_KEY + OPENROUTER_MODEL)
 * - openai-compatible: qualquer API no formato OpenAI (AI_BASE_URL + AI_MODEL, AI_API_KEY se exigir):
 *   Gemini, Cerebras, Mistral, Ollama local, etc.
 * Sem AI_PROVIDER, usa Claude quando há ANTHROPIC_API_KEY e Groq caso contrário.
 */

export type ChatProvider = "anthropic" | "groq" | "openrouter" | "openai-compatible";
export type ChatModel = { model: LanguageModel; maxOutputTokens: number; provider: ChatProvider };

const PROVIDERS: readonly ChatProvider[] = ["anthropic", "groq", "openrouter", "openai-compatible"];

const number = (value: string | undefined, fallback: number) => Number(value) || fallback;

export const chatProvider = (): ChatProvider => {
  const chosen = process.env.AI_PROVIDER?.toLowerCase();
  if (PROVIDERS.includes(chosen as ChatProvider)) return chosen as ChatProvider;
  return process.env.ANTHROPIC_API_KEY ? "anthropic" : "groq";
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1";

/** APIs no formato OpenAI: o limite de saída é generoso (os modelos gratuitos variam, ajuste em AI_MAX_OUTPUT_TOKENS). */
const openAICompatible = (provider: "openrouter" | "openai-compatible"): ChatModel => {
  const openrouter = provider === "openrouter";
  const baseURL = openrouter ? (process.env.OPENROUTER_BASE_URL || OPENROUTER_URL) : process.env.AI_BASE_URL;
  const apiKey = openrouter ? process.env.OPENROUTER_API_KEY : process.env.AI_API_KEY;
  const modelId = openrouter ? process.env.OPENROUTER_MODEL : process.env.AI_MODEL;
  if (!baseURL) throw new HttpError(500, "AI_BASE_URL não configurada no backend (.env).");
  if (openrouter && !apiKey) throw new HttpError(500, "OPENROUTER_API_KEY não configurada no backend (.env).");
  if (!modelId) {
    throw new HttpError(500, `${openrouter ? "OPENROUTER_MODEL" : "AI_MODEL"} não configurado no backend (.env).`);
  }
  return {
    provider,
    // chave opcional: servidores locais (Ollama) não exigem
    model: createOpenAICompatible({ name: provider, baseURL, ...(apiKey ? { apiKey } : {}) })(modelId),
    maxOutputTokens: number(process.env.AI_MAX_OUTPUT_TOKENS, 4096),
  };
};

export const resolveChatModel = (): ChatModel => {
  const provider = chatProvider();
  if (provider === "openrouter" || provider === "openai-compatible") return openAICompatible(provider);
  if (provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new HttpError(500, "ANTHROPIC_API_KEY não configurada no backend (.env).");
    return {
      provider: "anthropic",
      model: createAnthropic({ apiKey })(process.env.ANTHROPIC_MODEL || "claude-opus-5-5"),
      // o raciocínio do modelo também conta nesse limite: não deixar curto
      maxOutputTokens: number(process.env.CHAT_MAX_OUTPUT_TOKENS, 8192),
    };
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new HttpError(500, "GROQ_API_KEY não configurada no backend (.env).");
  return {
    provider: "groq",
    model: createGroq({ apiKey })(process.env.GROQ_MODEL || "qwen/qwen3.8-27b"),
    // o plano da Groq limita a saída por minuto; sem max_tokens a API estima e rejeita ("Request too large")
    maxOutputTokens: number(process.env.GROQ_MAX_OUTPUT_TOKENS, 900),
  };
};
