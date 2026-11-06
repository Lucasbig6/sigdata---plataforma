/** Carrega `.env` (se existir) antes de qualquer módulo ler process.env. */
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");

/**
 * Confere as variáveis obrigatórias na subida do servidor, para falhar de
 * imediato (e com mensagem clara) em vez de na primeira requisição.
 * Chamada só pelo `server.ts`: importar este módulo nos testes não valida nada.
 */
export const validateEnv = (env: NodeJS.ProcessEnv = process.env) => {
  const problems: string[] = [];
  if (!env.DATABASE_URL) problems.push("DATABASE_URL não definida.");
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
    problems.push("BETTER_AUTH_SECRET ausente ou curta (mínimo 32 caracteres).");
  }
  if (!env.BETTER_AUTH_URL) problems.push("BETTER_AUTH_URL não definida (URL pública do frontend).");
  const key = env.SIGDATA_ENCRYPTION_KEY ? Buffer.from(env.SIGDATA_ENCRYPTION_KEY, "base64") : null;
  if (!key || key.length !== 32) problems.push("SIGDATA_ENCRYPTION_KEY ausente ou inválida (32 bytes em base64).");
  if (env.PORT && !Number.isInteger(Number(env.PORT))) problems.push("PORT inválida.");
  return problems;
};

export const assertEnv = () => {
  const problems = validateEnv();
  if (problems.length === 0) return;
  console.error(`[sigdata] configuração inválida:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  console.error("[sigdata] veja backend/.env.example");
  process.exit(1);
};
