import { z } from "zod";

export const postgresConnectionSchema = z.object({
  host: z.string().trim().min(1, "informe o host").max(255),
  port: z.coerce.number().int().min(1).max(65535).default(5432),
  database: z.string().trim().min(1, "informe o banco").max(128),
  user: z.string().trim().min(1, "informe o usuário").max(128),
  password: z.string().max(512).default(""),
  ssl: z.boolean().default(false),
  sslVerify: z.boolean().default(true),
  schemas: z.array(z.string().trim().max(128)).max(20).optional(),
});

export const createPostgresSchema = z.object({
  kind: z.literal("postgresql"),
  name: z.string().max(120).default(""),
  description: z.string().max(500).default(""),
  connection: postgresConnectionSchema,
});

const columnName = z.string().min(1).max(128);

export const stepSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1).max(64),
    type: z.literal("filtrar"),
    column: columnName,
    op: z.enum(["=", "!=", ">", ">=", "<", "<=", "contem", "nulo", "nao_nulo"]),
    value: z.union([z.string().max(1000), z.number().finite(), z.boolean()]).optional(),
  }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("renomear"), from: columnName, to: z.string().max(256) }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("remover"), columns: z.array(columnName).max(500) }),
  z.object({
    id: z.string().min(1).max(64),
    type: z.literal("tipo"),
    column: columnName,
    to: z.enum(["numero", "texto", "data", "booleano"]),
  }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("ordenar"), column: columnName, dir: z.enum(["asc", "desc"]) }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("remover_nulos"), columns: z.array(columnName).max(500) }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("duplicadas"), columns: z.array(columnName).max(500) }),
]);

/** Tabela da fonte e etapas aplicadas sobre ela (no máximo 50; o compilador confere de novo). */
export const pipelineBodySchema = z.object({
  table: z.string().min(1).max(256),
  steps: z.array(stepSchema).max(50),
  /** Usa só as primeiras N etapas (ver os dados "naquele ponto"). */
  upTo: z.number().int().min(0).max(50).optional(),
});
