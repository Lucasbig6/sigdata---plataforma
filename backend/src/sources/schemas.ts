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
const stepId = z.string().min(1).max(64);
const stepValue = z.union([z.string().max(1000), z.number().finite(), z.boolean()]);
const filterOp = z.enum(["=", "!=", ">", ">=", "<", "<=", "contem", "nulo", "nao_nulo"]);
const aggFn = z.enum(["soma", "media", "minimo", "maximo", "contagem", "distintos"]);

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
  z.object({
    id: z.string().min(1).max(64),
    type: z.literal("preencher"),
    column: columnName,
    value: z.union([z.string().max(1000), z.number().finite(), z.boolean()]),
  }),
  z.object({
    id: z.string().min(1).max(64),
    type: z.literal("agrupar"),
    by: z.array(columnName).max(100),
    aggregations: z
      .array(
        z.object({
          column: columnName.nullable(),
          fn: aggFn,
          as: z.string().max(256),
        }),
      )
      .max(100),
  }),
  z.object({
    id: z.string().min(1).max(64),
    type: z.literal("mesclar"),
    table: z.string().max(256),
    query: stepId.optional(),
    kind: z.enum(["esquerda", "interna", "direita", "completa"]),
    on: z.array(z.object({ left: columnName, right: columnName })).min(1).max(10),
    columns: z.array(columnName).max(500),
  }),
  z.object({ id: stepId, type: z.literal("escolher"), columns: z.array(columnName).min(1).max(500) }),
  z.object({ id: stepId, type: z.literal("limitar"), mode: z.enum(["manter", "remover"]), n: z.number().int().min(1).max(1_000_000) }),
  z.object({
    id: stepId,
    type: z.literal("dividir"),
    column: columnName,
    delimiter: z.string().min(1).max(20),
    parts: z.number().int().min(2).max(10),
    removeOriginal: z.boolean(),
  }),
  z.object({ id: stepId, type: z.literal("substituir"), column: columnName, find: z.string().min(1).max(1000), with: z.string().max(1000) }),
  z.object({
    id: stepId,
    type: z.literal("condicional"),
    name: z.string().max(256),
    column: columnName,
    op: filterOp,
    value: stepValue.optional(),
    then: stepValue,
    otherwise: stepValue,
  }),
  z.object({ id: stepId, type: z.literal("indice"), name: z.string().max(256), start: z.union([z.literal(0), z.literal(1)]) }),
  z.object({
    id: stepId,
    type: z.literal("calcular"),
    name: z.string().max(256),
    left: columnName,
    op: z.enum(["+", "-", "*", "/"]),
    right: z.union([z.object({ column: columnName }), z.object({ value: z.number().finite() })]),
  }),
  z.object({ id: stepId, type: z.literal("texto"), column: columnName, fn: z.enum(["maiusculas", "minusculas", "aparar"]) }),
  z.object({
    id: stepId,
    type: z.literal("data_parte"),
    column: columnName,
    part: z.enum(["ano", "mes", "dia", "trimestre", "dia_semana"]),
    name: z.string().max(256),
  }),
  z.object({ id: stepId, type: z.literal("arredondar"), column: columnName, digits: z.number().int().min(0).max(10) }),
  z.object({
    id: stepId,
    type: z.literal("filtrar_valores"),
    column: columnName,
    values: z.array(z.string().max(1000)).min(1).max(500),
    mode: z.enum(["incluir", "excluir"]),
  }),
  z.object({ id: stepId, type: z.literal("acrescentar"), query: stepId }),
  z.object({
    id: z.string().min(1).max(64),
    type: z.literal("dinamizar"),
    column: columnName,
    values: z.array(z.string().max(256)).min(1).max(50),
    value: columnName,
    fn: aggFn,
    by: z.array(columnName).max(100),
  }),
]);

/** Consultas abertas na preparação de dados e qual delas é o resultado. */
export const workspaceSchema = z.object({
  queries: z
    .array(
      z.object({
        id: stepId,
        name: z.string().max(120),
        sourceId: z.string().min(1).max(64),
        table: z.string().min(1).max(256),
        steps: z.array(stepSchema).max(100),
      }),
    )
    .min(1)
    .max(8),
  target: stepId,
});

/** Corpo comum da prévia, do perfil e dos valores distintos. */
export const workspaceBodySchema = z.object({
  workspace: workspaceSchema,
  /** Usa só as primeiras N etapas da consulta de destino (ver os dados "naquele ponto"). */
  upTo: z.number().int().min(0).max(100).optional(),
});
