import { z } from "zod";

export const postgresConnectionSchema = z.object({
  host: z.string().trim().min(1, "informe o host").max(255),
  port: z.coerce.number().int().min(1).max(65535).default(5432),
  database: z.string().trim().min(1, "informe o banco").max(128),
  user: z.string().trim().min(1, "informe o usuário").max(128),
  password: z.string().max(512).default(""),
  ssl: z.boolean().default(false),
  schemas: z.array(z.string().trim().max(128)).max(20).optional(),
});

export const createPostgresSchema = z.object({
  kind: z.literal("postgresql"),
  name: z.string().max(120).default(""),
  description: z.string().max(500).default(""),
  connection: postgresConnectionSchema,
});
