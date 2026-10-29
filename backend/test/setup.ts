/**
 * Ambiente isolado dos testes: precisa ser importado ANTES dos módulos do app.
 * Nada aqui conecta ao Postgres nem à Groq; o armazenamento DuckDB vai para uma pasta temporária.
 */
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export const STORAGE_TESTE = mkdtempSync(path.join(tmpdir(), "sigdata-teste-"));

process.env.DATABASE_URL = "postgres://teste@127.0.0.1:1/teste"; // endereço inválido de propósito: o pool só conecta quando há consulta
process.env.BETTER_AUTH_SECRET = randomBytes(32).toString("base64url");
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.SIGDATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.SIGDATA_STORAGE_DIR = STORAGE_TESTE;
