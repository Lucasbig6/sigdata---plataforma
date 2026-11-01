import "./setup";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { validateEnv } from "../src/env";
import { createLimiter } from "../src/rate-limit";

test("limitador bloqueia depois do máximo e libera na nova janela", () => {
  const limit = createLimiter({ windowMs: 1000, max: 2 });
  assert.equal(limit("a", 0).allowed, true);
  assert.equal(limit("a", 10).allowed, true);
  const blocked = limit("a", 20);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSec >= 1);
  assert.equal(limit("b", 20).allowed, true, "chaves independentes");
  assert.equal(limit("a", 1500).allowed, true, "nova janela");
});

test("validateEnv aponta variáveis ausentes ou inválidas", () => {
  assert.ok(validateEnv({}).length >= 4);
  const ok = {
    DATABASE_URL: "postgres://x",
    BETTER_AUTH_SECRET: randomBytes(32).toString("base64url"),
    BETTER_AUTH_URL: "http://localhost:3000",
    SIGDATA_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  };
  assert.deepEqual(validateEnv(ok), []);
  assert.equal(validateEnv({ ...ok, SIGDATA_ENCRYPTION_KEY: "curta" }).length, 1);
  assert.equal(validateEnv({ ...ok, BETTER_AUTH_SECRET: "curto" }).length, 1);
});
