import "./setup";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { chatProvider, resolveChatModel } from "../src/ai-model";

const KEYS = ["AI_PROVIDER", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "GROQ_API_KEY", "CHAT_MAX_OUTPUT_TOKENS"] as const;
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

const clear = () => KEYS.forEach((key) => delete process.env[key]);

test("sem AI_PROVIDER, usa Claude quando há chave da Anthropic e Groq caso contrário", () => {
  clear();
  assert.equal(chatProvider(), "groq");
  process.env.ANTHROPIC_API_KEY = "sk-teste";
  assert.equal(chatProvider(), "anthropic");
  process.env.AI_PROVIDER = "groq";
  assert.equal(chatProvider(), "groq", "AI_PROVIDER manda");
});

test("Claude: modelo padrão, limite de saída folgado e chave obrigatória", () => {
  clear();
  process.env.AI_PROVIDER = "anthropic";
  assert.throws(() => resolveChatModel(), /ANTHROPIC_API_KEY/);
  process.env.ANTHROPIC_API_KEY = "sk-teste";
  const padrao = resolveChatModel();
  assert.equal(padrao.provider, "anthropic");
  assert.equal(padrao.maxOutputTokens, 8192);
  assert.equal((padrao.model as { modelId: string }).modelId, "claude-opus-5-5");
  process.env.ANTHROPIC_MODEL = "claude-sonnet-5-5";
  assert.equal((resolveChatModel().model as { modelId: string }).modelId, "claude-sonnet-5-5");
});

test("Groq mantém o limite de saída curto do plano", () => {
  clear();
  process.env.AI_PROVIDER = "groq";
  assert.throws(() => resolveChatModel(), /GROQ_API_KEY/);
  process.env.GROQ_API_KEY = "gsk-teste";
  assert.equal(resolveChatModel().maxOutputTokens, 900);
});
