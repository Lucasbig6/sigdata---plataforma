import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AnalysisSnapshot } from "@shared/analyses";
import type { ActiveFilter } from "@shared/dashboards/data";
import { FILTER_VALUE_MAX } from "@shared/dashboards/data";
import { allElements, type DashboardElement, type DataBinding, type FilterBinding } from "@shared/dashboards/types";
import type { WorkspaceProject } from "@shared/dashboards/workspace";
import { BINDING_LIMIT_MAX } from "@shared/dashboards/types";
import { filterOptions, runBinding } from "../dashboard-data";
import { db, schema } from "../db";
import {
  analysesForDashboard,
  getDashboardRow,
  parseDashboard,
  toDashboard,
  toDoc,
  toSavedAnalysis,
} from "../dashboards";
import { errorResponse, handle, HttpError, notFound, parseBody } from "../http";

const readJson = (req: Request) => req.json().catch(() => null) as Promise<Record<string, unknown> | null>;

/* --------------------------------------------------------- dados ao vivo */

const name = z.string().min(1).max(256);

const bindingSchema = z.object({
  sourceId: z.string().min(1).max(64),
  mode: z.enum(["builder", "sql"]),
  table: name.optional(),
  dimension: name.optional(),
  measure: name.optional(),
  agg: z.enum(["sum", "avg", "count", "min", "max"]).optional(),
  sort: z.enum(["valor_desc", "valor_asc", "label_asc", "label_desc"]).optional(),
  limit: z.number().int().min(1).max(BINDING_LIMIT_MAX).optional(),
  columns: z.array(name).max(100).optional(),
  sql: z.string().max(20_000).optional(),
  x: name.optional(),
  y: name.optional(),
  ys: z.array(name).max(12).optional(),
  splitBy: name.optional(),
  calc: z.object({ name: z.string().min(1).max(80), expr: z.string().min(1).max(300) }).optional(),
  compare: z
    .object({ dateColumn: name, unit: z.enum(["day", "week", "month", "quarter", "year"]) })
    .optional(),
});

const filterBindingSchema = z.object({ sourceId: z.string().min(1).max(64), table: name, column: name });

const activeFilterSchema = filterBindingSchema.extend({
  value: z.string().max(FILTER_VALUE_MAX),
  range: z.boolean().optional(),
  byName: z.boolean().optional(),
});

const dataSchema = z.object({
  binding: bindingSchema,
  filters: z.array(activeFilterSchema).max(20).optional(),
  fresh: z.boolean().optional(),
});

/* -------------------------------------------------------------- dashboards */

export const dashboardsRoutes = new Hono();

/** Executa a ligação de um elemento (editor, fontes do próprio usuário). */
dashboardsRoutes.post(
  "/data",
  handle(async ({ req, user }) => {
    const body = await parseBody(req, dataSchema);
    return runBinding(user.id, body.binding as DataBinding, body.filters ?? [], { fresh: body.fresh });
  }),
);

dashboardsRoutes.post(
  "/filter-options",
  handle(async ({ req, user }) => {
    const body = await parseBody(req, z.object({ binding: filterBindingSchema }));
    return filterOptions(user.id, body.binding);
  }),
);

/**
 * Visualizações salvas nos workspaces dos projetos. As que vieram de uma
 * consulta (resultId) carregam fonte + SQL para virar elemento ao vivo; as
 * demais seguem com a cópia dos dados.
 */
dashboardsRoutes.get(
  "/workspace",
  handle(async ({ user }): Promise<WorkspaceProject[]> => {
    const projects = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.userId, user.id))
      .orderBy(desc(schema.projects.updatedAt));
    if (projects.length === 0) return [];

    const panels = await db
      .select()
      .from(schema.projectPanels)
      .where(
        inArray(
          schema.projectPanels.projectId,
          projects.map((project) => project.id),
        ),
      );
    const widgetsByProject = new Map(panels.map((panel) => [panel.projectId, panel.widgets]));

    const resultIds = [
      ...new Set(panels.flatMap((panel) => panel.widgets.flatMap((w) => (w.resultId ? [w.resultId] : [])))),
    ];
    const results =
      resultIds.length === 0
        ? []
        : await db
            .select({
              id: schema.results.id,
              sourceId: schema.results.sourceId,
              sql: schema.results.sql,
              columns: schema.results.columns,
            })
            .from(schema.results)
            .where(and(eq(schema.results.userId, user.id), inArray(schema.results.id, resultIds)));
    const resultById = new Map(results.map((result) => [result.id, result]));

    return projects
      .map((project) => ({
        id: project.id,
        title: project.title,
        sourceId: project.sourceId,
        visuals: [...(widgetsByProject.get(project.id) ?? [])]
          .sort((a, b) => a.z - b.z)
          .map((widget) => {
            const result = widget.resultId ? resultById.get(widget.resultId) : undefined;
            if (!result?.sourceId) return { widget, live: null };
            const { series: _s, rows: _r, table: _t, ...light } = widget;
            return {
              widget: light,
              live: { sourceId: result.sourceId, sql: result.sql, columns: result.columns },
            };
          }),
      }))
      .filter((project) => project.visuals.length > 0);
  }),
);

dashboardsRoutes.get(
  "/",
  handle(async ({ user }) => {
    const rows = await db
      .select()
      .from(schema.dashboards)
      .where(eq(schema.dashboards.userId, user.id))
      .orderBy(desc(schema.dashboards.updatedAt));
    return rows.map(toDashboard);
  }),
);

dashboardsRoutes.post(
  "/",
  handle(async ({ req, user }) => {
    const doc = parseDashboard(await readJson(req));
    const [row] = await db
      .insert(schema.dashboards)
      .values({
        id: doc.id,
        userId: user.id,
        name: doc.name.trim() || "Novo dashboard",
        description: doc.description,
        origin: "user",
        doc: toDoc(doc),
      })
      .onConflictDoNothing()
      .returning();
    if (!row) throw new HttpError(409, "Já existe um dashboard com este id.");
    return toDashboard(row);
  }),
);

dashboardsRoutes.get(
  "/:id",
  handle<{ id: string }>(async ({ user, params }) => toDashboard(await getDashboardRow(user.id, params.id))),
);

dashboardsRoutes.put(
  "/:id",
  handle<{ id: string }>(async ({ req, user, params }) => {
    const existing = await getDashboardRow(user.id, params.id);
    const doc = parseDashboard({ ...(await readJson(req)), id: existing.id });
    await snapshotVersion(existing, "");
    const [row] = await db
      .update(schema.dashboards)
      .set({
        name: doc.name.trim() || "Dashboard sem nome",
        description: doc.description,
        doc: toDoc(doc),
        updatedAt: new Date(),
      })
      .where(eq(schema.dashboards.id, existing.id))
      .returning();
    return toDashboard(row);
  }),
);

dashboardsRoutes.delete(
  "/:id",
  handle<{ id: string }>(async ({ user, params }) => {
    const existing = await getDashboardRow(user.id, params.id);
    await db.delete(schema.dashboards).where(eq(schema.dashboards.id, existing.id));
    return { ok: true };
  }),
);

/* ---------------------------------------------------------------- versões */

const AUTO_VERSION_GAP_MS = 10 * 60 * 1000;
const MAX_VERSIONS = 40;

type DashboardRow = typeof schema.dashboards.$inferSelect;

/**
 * Guarda o estado atual do dashboard no histórico. Versões automáticas (sem
 * nome) são espaçadas para não encher o histórico a cada salvamento.
 */
const snapshotVersion = async (row: DashboardRow, label: string) => {
  if (allElements(row.doc).length === 0 && !label) return;
  if (!label) {
    const [last] = await db
      .select({ createdAt: schema.dashboardVersions.createdAt })
      .from(schema.dashboardVersions)
      .where(eq(schema.dashboardVersions.dashboardId, row.id))
      .orderBy(desc(schema.dashboardVersions.createdAt))
      .limit(1);
    if (last && Date.now() - last.createdAt.getTime() < AUTO_VERSION_GAP_MS) return;
  }
  await db.insert(schema.dashboardVersions).values({
    id: randomUUID(),
    dashboardId: row.id,
    userId: row.userId,
    label,
    name: row.name,
    doc: row.doc,
  });
  // mantém só as mais recentes (as com nome não contam para o limite de limpeza)
  const old = await db
    .select({ id: schema.dashboardVersions.id })
    .from(schema.dashboardVersions)
    .where(and(eq(schema.dashboardVersions.dashboardId, row.id), eq(schema.dashboardVersions.label, "")))
    .orderBy(desc(schema.dashboardVersions.createdAt))
    .offset(MAX_VERSIONS);
  if (old.length > 0) {
    await db.delete(schema.dashboardVersions).where(
      inArray(
        schema.dashboardVersions.id,
        old.map((entry) => entry.id),
      ),
    );
  }
};

dashboardsRoutes.get(
  "/:id/versions",
  handle<{ id: string }>(async ({ user, params }) => {
    const row = await getDashboardRow(user.id, params.id);
    const versions = await db
      .select()
      .from(schema.dashboardVersions)
      .where(eq(schema.dashboardVersions.dashboardId, row.id))
      .orderBy(desc(schema.dashboardVersions.createdAt))
      .limit(100);
    return versions.map((version) => ({
      id: version.id,
      label: version.label,
      name: version.name,
      createdAt: version.createdAt.getTime(),
      elements: allElements(version.doc).length,
      pages: version.doc.pages?.length ?? 1,
    }));
  }),
);

/** Salva o estado atual (já gravado) como uma versão com nome. */
dashboardsRoutes.post(
  "/:id/versions",
  handle<{ id: string }>(async ({ req, user, params }) => {
    const row = await getDashboardRow(user.id, params.id);
    const body = await parseBody(req, z.object({ label: z.string().trim().min(1).max(80) }));
    await snapshotVersion(row, body.label);
    return { ok: true };
  }),
);

dashboardsRoutes.post(
  "/:id/versions/:versionId/restore",
  handle<{ id: string; versionId: string }>(async ({ user, params }) => {
    const row = await getDashboardRow(user.id, params.id);
    const [version] = await db
      .select()
      .from(schema.dashboardVersions)
      .where(and(eq(schema.dashboardVersions.id, params.versionId), eq(schema.dashboardVersions.dashboardId, row.id)));
    if (!version) throw notFound("Versão", "a");
    // o estado de agora também vira uma versão: restaurar é sempre reversível
    await snapshotVersion(row, "Antes de restaurar");
    const [updated] = await db
      .update(schema.dashboards)
      .set({ doc: version.doc, name: version.name, updatedAt: new Date() })
      .where(eq(schema.dashboards.id, row.id))
      .returning();
    return toDashboard(updated);
  }),
);

dashboardsRoutes.delete(
  "/:id/versions/:versionId",
  handle<{ id: string; versionId: string }>(async ({ user, params }) => {
    const row = await getDashboardRow(user.id, params.id);
    await db
      .delete(schema.dashboardVersions)
      .where(and(eq(schema.dashboardVersions.id, params.versionId), eq(schema.dashboardVersions.dashboardId, row.id)));
    return { ok: true };
  }),
);

/** Gera (ou devolve) o link público somente-leitura. */
dashboardsRoutes.post(
  "/:id/share",
  handle<{ id: string }>(async ({ user, params }) => {
    const row = await getDashboardRow(user.id, params.id);
    if (row.shareToken) return { token: row.shareToken };
    const token = randomBytes(18).toString("base64url");
    await db
      .update(schema.dashboards)
      .set({ shareToken: token, sharedAt: new Date() })
      .where(eq(schema.dashboards.id, row.id));
    return { token };
  }),
);

/** Revoga o link: o token antigo deixa de funcionar imediatamente. */
dashboardsRoutes.delete(
  "/:id/share",
  handle<{ id: string }>(async ({ user, params }) => {
    const row = await getDashboardRow(user.id, params.id);
    await db
      .update(schema.dashboards)
      .set({ shareToken: null, sharedAt: null })
      .where(eq(schema.dashboards.id, row.id));
    return { ok: true };
  }),
);

/* ---------------------------------------------------------------- públicas */

export const publicRoutes = new Hono();

const sharedDashboard = async (token: string) => {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) throw notFound("Link");
  const [row] = await db
    .select()
    .from(schema.dashboards)
    .where(eq(schema.dashboards.shareToken, token));
  if (!row) throw notFound("Link");
  return row;
};

type BoundProps = { binding?: DataBinding };
type FilterProps = { binding?: FilterBinding; global?: boolean; mode?: "list" | "range" };

const DATA_ELEMENT_TYPES = new Set<DashboardElement["type"]>(["chart", "table", "kpi", "percent", "comparison"]);

const findElement = (elements: DashboardElement[], id: string) => {
  const element = elements.find((entry) => entry.id === id);
  if (!element) throw notFound("Elemento");
  return element;
};

/** Sem login: só responde a tokens de compartilhamento válidos. */
publicRoutes.get("/dashboards/:token", async (c) => {
  try {
    const row = await sharedDashboard(c.req.param("token"));
    const { shareToken: _omit, ...dashboard } = toDashboard(row);
    return Response.json({ dashboard, analyses: await analysesForDashboard(row) });
  } catch (error) {
    return errorResponse(error);
  }
});

const publicDataSchema = z.object({
  elementId: z.string().min(1).max(64),
  filters: z
    .array(z.object({ elementId: z.string().min(1).max(64), value: z.string().max(FILTER_VALUE_MAX) }))
    .max(20)
    .optional(),
});

/**
 * Dados de um elemento do painel compartilhado. Só executa ligações que estão
 * na versão salva; o visitante escolhe apenas valores dos filtros salvos.
 */
publicRoutes.post("/dashboards/:token/data", async (c) => {
  try {
    const row = await sharedDashboard(c.req.param("token"));
    const body = await parseBody(c.req.raw, publicDataSchema);
    const elements = allElements(row.doc);
    const element = findElement(elements, body.elementId);
    // só elementos que exibem dados; filtros têm ligação de outro formato
    if (!DATA_ELEMENT_TYPES.has(element.type)) throw new HttpError(400, "Elemento não exibe dados.");
    const binding = (element.props as BoundProps).binding;
    if (!binding) throw new HttpError(400, "Elemento sem dados ligados.");
    // a coluna nunca vem do visitante: deriva do filtro ou do gráfico salvo (filtro cruzado)
    const filters: ActiveFilter[] = (body.filters ?? []).flatMap((filter) => {
      const source = findElement(elements, filter.elementId);
      if (source.type === "filter") {
        const props = source.props as FilterProps;
        return props.binding
          ? [{ ...props.binding, value: filter.value, byName: props.global === true, range: props.mode === "range" }]
          : [];
      }
      if (source.type === "chart") {
        const cb = (source.props as BoundProps).binding;
        return cb?.mode === "builder" && cb.table && cb.dimension
          ? [{ sourceId: cb.sourceId, table: cb.table, column: cb.dimension, value: filter.value }]
          : [];
      }
      return [];
    });
    return Response.json(await runBinding(row.userId, binding, filters));
  } catch (error) {
    return errorResponse(error);
  }
});

publicRoutes.post("/dashboards/:token/filter-options", async (c) => {
  try {
    const row = await sharedDashboard(c.req.param("token"));
    const body = await parseBody(c.req.raw, z.object({ elementId: z.string().min(1).max(64) }));
    const element = findElement(allElements(row.doc), body.elementId);
    if (element.type !== "filter") throw new HttpError(400, "Elemento não é um filtro.");
    const binding = (element.props as FilterProps).binding;
    if (!binding) return Response.json({ options: [] });
    return Response.json(await filterOptions(row.userId, binding));
  } catch (error) {
    return errorResponse(error);
  }
});

/* ---------------------------------------------------------------- análises */

export const analysesRoutes = new Hono();

analysesRoutes.get(
  "/",
  handle(async ({ user }) => {
    const rows = await db
      .select()
      .from(schema.analyses)
      .where(eq(schema.analyses.userId, user.id))
      .orderBy(desc(schema.analyses.savedAt))
      .limit(200);
    return rows.map(toSavedAnalysis);
  }),
);

const analysisSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().max(200),
  snapshot: z.object({
    kpis: z.array(z.unknown()).max(50),
    serie: z.array(z.unknown()).max(5000),
    municipios: z.array(z.unknown()).max(5000),
    resumos: z.array(z.unknown()).max(50),
    tabela: z
      .object({
        columns: z.array(z.string()).max(100),
        rows: z.array(z.record(z.string(), z.unknown())).max(5000),
      })
      .optional(),
  }),
});

analysesRoutes.post(
  "/",
  handle(async ({ req, user }) => {
    const body = await parseBody(req, analysisSchema);
    const snapshot = body.snapshot as AnalysisSnapshot;
    const title = body.title.trim() || "Análise sem título";
    const [row] = await db
      .insert(schema.analyses)
      .values({ id: body.id, userId: user.id, title, snapshot })
      .onConflictDoUpdate({
        target: schema.analyses.id,
        set: { title, snapshot, savedAt: new Date() },
        // só atualiza se a análise for do próprio usuário
        setWhere: eq(schema.analyses.userId, user.id),
      })
      .returning();
    if (!row) throw new HttpError(409, "Id de análise já utilizado.");
    return toSavedAnalysis(row);
  }),
);
