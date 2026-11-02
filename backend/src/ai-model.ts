import { createAnthropic } from "@ai-sdk/anthropic";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";
import { HttpError } from "./http";

/**
 * Modelo do chat. Escolha com AI_PROVIDER=anthropic|groq; sem ele, usa Claude quando há
 * ANTHROPIC_API_KEY e Groq caso contrário.
 */

export type ChatModel = { model: LanguageModel; maxOutputTokens: number; provider: "anthropic" | "groq" };

const number = (value: string | undefined, fallback: number) => Number(value) || fallback;

export const chatProvider = (): "anthropic" | "groq" => {
  const chosen = process.env.AI_PROVIDER?.toLowerCase();
  if (chosen === "anthropic" || chosen === "groq") return chosen;
  return process.env.ANTHROPIC_API_KEY ? "anthropic" : "groq";
};

export const resolveChatModel = (): ChatModel => {
  if (chatProvider() === "anthropic") {
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
