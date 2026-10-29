import { Hono } from "hono";
import { z } from "zod";
import { handle, HttpError, parseBody } from "../http";
import { getProject } from "../projects";
import { createPostgresSchema, postgresConnectionSchema } from "../sources/schemas";
import {
  createDataset,
  EDITOR_PAGE_SIZES,
  createFromUpload,
  createPostgres,
  deleteSource,
  getResult,
  listRecentResults,
  getSourceRow,
  listSources,
  previewTable,
  profileTable,
  refreshSource,
  runEditorQuery,
  runQuery,
  testPostgres,
  toDataSource,
  updateSourceMeta,
} from "../sources/service";

/**
 * Fontes e datasets: catálogo comum. Leitura (listar, inspecionar, consultar pelo
 * chat) é de todos; criar, tratar no editor SQL e alterar é do analista para cima.
 */
const ANALISTA = { role: "analista" } as const;

export const sourcesRoutes = new Hono();

sourcesRoutes.get("/", handle(async () => listSources()));

/** multipart (arquivo CSV/XLSX) ou JSON (conexão Postgres). */
sourcesRoutes.post(
  "/",
  handle(async ({ req, user }) => {
    const type = req.headers.get("content-type") ?? "";
    if (type.startsWith("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new HttpError(400, 'Envie um arquivo no campo "file".');
      return createFromUpload(user.id, {
        file,
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? ""),
      });
    }
    return createPostgres(user.id, await parseBody(req, createPostgresSchema));
  }, ANALISTA),
);

const datasetSchema = z.object({
  sourceId: z.string().min(1),
  sql: z.string().min(1).max(20_000),
  name: z.string().trim().min(1, "Dê um nome ao dataset.").max(120),
  description: z.string().max(500).default(""),
});

/** Cria um dataset a partir de uma consulta SQL sobre uma fonte existente. */
sourcesRoutes.post(
  "/dataset",
  handle(async ({ req, user }) => createDataset(user.id, await parseBody(req, datasetSchema)), ANALISTA),
);

sourcesRoutes.post(
  "/test",
  handle(async ({ req }) => testPostgres(await parseBody(req, postgresConnectionSchema)), ANALISTA),
);

sourcesRoutes.get(
  "/:id",
  handle<{ id: string }>(async ({ params }) => toDataSource(await getSourceRow(params.id))),
);

const patchSchema = z.object({
  name: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
});

sourcesRoutes.patch(
  "/:id",
  handle<{ id: string }>(
    async ({ req, params }) => updateSourceMeta(params.id, await parseBody(req, patchSchema)),
    ANALISTA,
  ),
);

sourcesRoutes.delete(
  "/:id",
  handle<{ id: string }>(async ({ params }) => {
    await deleteSource(params.id);
    return { ok: true };
  }, ANALISTA),
);

sourcesRoutes.post(
  "/:id/refresh",
  handle<{ id: string }>(async ({ params }) => refreshSource(params.id), ANALISTA),
);

const tableParam = (req: Request) => {
  const table = new URL(req.url).searchParams.get("table");
  if (!table) throw new HttpError(400, "Informe ?table=");
  return table;
};

sourcesRoutes.get(
  "/:id/preview",
  handle<{ id: string }>(async ({ req, params }) => previewTable(params.id, tableParam(req))),
);

sourcesRoutes.get(
  "/:id/profile",
  handle<{ id: string }>(async ({ req, params }) => profileTable(params.id, tableParam(req))),
);

const querySchema = z.object({
  sql: z.string().min(1).max(20_000),
  title: z.string().max(160).default("Consulta manual"),
  projectId: z.string().nullable().optional(),
});

/** Editor SQL do analista: prévia da consulta, sem gravar o resultado. */
sourcesRoutes.post(
  "/:id/run",
  handle<{ id: string }>(async ({ req, params }) => {
    const body = await parseBody(
      req,
      z.object({
        sql: z.string().min(1).max(20_000),
        page: z.number().int().min(1).max(100_000).default(1),
        pageSize: z
          .number()
          .int()
          .refine((size) => (EDITOR_PAGE_SIZES as readonly number[]).includes(size), "Tamanho de página inválido.")
          .default(100),
        count: z.boolean().default(false),
      }),
    );
    return runEditorQuery({ sourceId: params.id, ...body });
  }, ANALISTA),
);

sourcesRoutes.post(
  "/:id/query",
  handle<{ id: string }>(async ({ req, user, params }) => {
    const body = await parseBody(req, querySchema);
    if (body.projectId) await getProject(user.id, body.projectId);
    return runQuery(user.id, { ...body, sourceId: params.id });
  }),
);

export const resultsRoutes = new Hono();

/** Consultas recentes (sem as linhas) — para reaproveitar no editor de dashboards. */
resultsRoutes.get(
  "/",
  handle(async ({ user }) => listRecentResults(user.id)),
);

resultsRoutes.get(
  "/:id",
  handle<{ id: string }>(async ({ user, params }) => getResult(user.id, params.id)),
);
