import { serve } from "@hono/node-server";
import { assertEnv } from "./env";

assertEnv();

// importa depois da validação: os módulos leem process.env ao carregar
const { app } = await import("./app");

const port = Number(process.env.PORT) || 4000;

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[sigdata] backend em http://localhost:${info.port}/api`);
});

// encerramento gracioso: termina as requisições em andamento antes de sair
const shutdown = (signal: string) => {
  console.log(`[sigdata] ${signal} recebido, encerrando…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
