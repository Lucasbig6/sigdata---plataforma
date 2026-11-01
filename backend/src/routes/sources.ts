import { Hono } from "hono";
import { z } from "zod";
import { audit } from "../audit";
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
  setPublished,
  sourceUsage,
  getManagedSource,
  runEditorQuery,
  runQuery,
  testPostgres,
  toDataSource,
  updateSourceMeta,
} from "../sources/service";

export const sourcesRoutes = new Hono();

/** Importar fontes, SQL e datasets: só analistas e administradores. */
const analystHandle = <P extends Record<string, string> = Record<string, string>>(
  fn: Parameters<typeof handle<P>>[0],
) => handle<P>(fn, { roles: ["analista", "admin"] });

sourcesRoutes.get("/", handle(async ({ user }) => listSources(user)));

/** multipart (arquivo CSV/XLSX) ou JSON (conexão Postgres). */
sourcesRoutes.post(
  "/",
  analystHandle(async ({ req, user }) => {
    const type = req.headers.get("content-type") ?? "";
    if (type.startsWith("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new HttpError(400, 'Envie um arquivo no campo "file".');
      const created = await createFromUpload(user.id, {
        file,
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? ""),
      });
      await audit(user, "fonte.importada", created.name, file.name);
      return created;
    }
    const created = await createPostgres(user.id, await parseBody(req, createPostgresSchema));
    await audit(user, "fonte.conectada", created.name, created.connectionLabel ?? "");
    return created;
  }),
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
  analystHandle(async ({ req, user }) => {
    const created = await createDataset(user.id, await parseBody(req, datasetSchema));
    await audit(user, "dataset.criado", created.name);
    return created;
  }),
);

sourcesRoutes.post(
  "/test",
  analystHandle(async ({ req }) => testPostgres(await parseBody(req, postgresConnectionSchema))),
);

sourcesRoutes.get(
  "/:id",
  handle<{ id: string }>(async ({ user, params }) => toDataSource(await getSourceRow(user.id, params.id))),
);

const patchSchema = z.object({
  name: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
});

sourcesRoutes.patch(
  "/:id",
  analystHandle<{ id: string }>(async ({ req, user, params }) =>
    updateSourceMeta(user, params.id, await parseBody(req, patchSchema)),
  ),
);

sourcesRoutes.delete(
  "/:id",
  analystHandle<{ id: string }>(async ({ req, user, params }) => {
    const name = (await getManagedSource(user, params.id)).name;
    await deleteSource(user, params.id, new URL(req.url).searchParams.get("force") === "true");
    await audit(user, "fonte.excluida", name);
    return { ok: true };
  }),
);

/** Onde a fonte/dataset está em uso: base para avisar antes de despublicar ou excluir. */
sourcesRoutes.get(
  "/:id/usage",
  analystHandle<{ id: string }>(async ({ user, params }) => sourceUsage(user, params.id)),
);

/** Publica (ou retira) um dataset: usuários comuns só enxergam os publicados. */
sourcesRoutes.post(
  "/:id/publish",
  analystHandle<{ id: string }>(async ({ req, user, params }) => {
    const { published, force } = await parseBody(req, z.object({ published: z.boolean(), force: z.boolean().default(false) }));
    const dataset = await setPublished(user, params.id, published, force);
    await audit(user, published ? "dataset.publicado" : "dataset.despublicado", dataset.name);
    return dataset;
  }),
);

sourcesRoutes.post(
  "/:id/refresh",
  analystHandle<{ id: string }>(async ({ user, params }) => refreshSource(user, params.id)),
);

const tableParam = (req: Request) => {
  const table = new URL(req.url).searchParams.get("table");
  if (!table) throw new HttpError(400, "Informe ?table=");
  return table;
};

sourcesRoutes.get(
  "/:id/preview",
  handle<{ id: string }>(async ({ req, user, params }) => previewTable(user.id, params.id, tableParam(req))),
);

sourcesRoutes.get(
  "/:id/profile",
  handle<{ id: string }>(async ({ req, user, params }) => profileTable(user.id, params.id, tableParam(req))),
);

const querySchema = z.object({
  sql: z.string().min(1).max(20_000),
  title: z.string().max(160).default("Consulta manual"),
  projectId: z.string().nullable().optional(),
});

/** Editor SQL do analista: prévia da consulta, sem gravar o resultado. */
sourcesRoutes.post(
  "/:id/run",
  analystHandle<{ id: string }>(async ({ req, user, params }) => {
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
    return runEditorQuery(user.id, { sourceId: params.id, ...body });
  }),
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
