import { and, eq, inArray } from "drizzle-orm";
import type { SavedAnalysis } from "@shared/analyses";
import { allElements, HTML_CODE_MAX, migrateDashboard, type Dashboard } from "@shared/dashboards/types";
import { canManageData } from "@shared/roles";
import { db, schema } from "./db";
import { HttpError, notFound, type CurrentUser } from "./http";

type DashboardRow = typeof schema.dashboards.$inferSelect;

export type DashboardWithShare = Dashboard & { shareToken: string | null; projectId: string | null };

export const toDashboard = (row: DashboardRow): DashboardWithShare => ({
  id: row.id,
  schemaVersion: row.doc.schemaVersion,
  name: row.name,
  description: row.description,
  origin: row.origin,
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt.getTime(),
  canvas: row.doc.canvas,
  elements: row.doc.elements,
  ...(row.doc.pages && { pages: row.doc.pages }),
  ...(row.doc.measures && { measures: row.doc.measures }),
  shareToken: row.shareToken,
  projectId: row.projectId,
});

/** Valida o documento recebido com a mesma rotina usada na leitura local. */
export const parseDashboard = (raw: unknown): Dashboard => {
  const doc = migrateDashboard(raw);
  if (!doc) throw new HttpError(400, "Documento de dashboard inválido.");
  if (allElements(doc).length > 300) throw new HttpError(413, "Dashboard com elementos demais.");
  return doc;
};

type CustomCode = { html: string; css: string; js: string };

const codeOf = (element: { id: string; props: unknown }): CustomCode | null => {
  const props = element.props as Partial<Record<keyof CustomCode, unknown>>;
  const { html, css, js } = props;
  if (typeof html !== "string" || typeof css !== "string" || typeof js !== "string") return null;
  return { html, css, js };
};

/**
 * Visual personalizado (elemento "html"): o código é validado no servidor e só analistas e
 * administradores podem criá-lo ou alterá-lo. Quem perdeu o papel ainda salva o painel, desde que
 * o código dos visuais existentes continue igual ao que já estava salvo.
 */
export const assertCustomCode = (user: CurrentUser, doc: Pick<Dashboard, "elements" | "pages">, saved?: Dashboard["elements"]) => {
  const custom = allElements(doc).filter((element) => element.type === "html");
  if (custom.length === 0) return;
  const before = new Map(
    (saved ?? []).filter((element) => element.type === "html").map((element) => [element.id, codeOf(element)] as const),
  );
  for (const element of custom) {
    const code = codeOf(element);
    if (!code) throw new HttpError(400, "Visual personalizado com código inválido.");
    if ([code.html, code.css, code.js].some((part) => part.length > HTML_CODE_MAX)) {
      throw new HttpError(413, `Cada trecho de código aceita até ${HTML_CODE_MAX.toLocaleString("pt-BR")} caracteres.`);
    }
    const previous = before.get(element.id);
    const unchanged = previous && previous.html === code.html && previous.css === code.css && previous.js === code.js;
    if (!unchanged && !canManageData(user.role)) {
      throw new HttpError(403, "Só analistas e administradores podem criar ou editar HTML personalizado.");
    }
  }
};

export const getDashboardRow = async (userId: string, id: string) => {
  const [row] = await db
    .select()
    .from(schema.dashboards)
    .where(and(eq(schema.dashboards.id, id), eq(schema.dashboards.userId, userId)));
  if (!row) throw notFound("Dashboard");
  return row;
};

export const toSavedAnalysis = (row: typeof schema.analyses.$inferSelect): SavedAnalysis => ({
  id: row.id,
  title: row.title,
  savedAt: row.savedAt.getTime(),
  source: "chat",
  snapshot: row.snapshot,
});

/** O que é guardado no banco para um dashboard (topo = primeira página). */
export const toDoc = (doc: Dashboard) => ({
  schemaVersion: doc.schemaVersion,
  canvas: doc.canvas,
  elements: doc.elements,
  ...(doc.pages && { pages: doc.pages }),
  ...(doc.measures && { measures: doc.measures }),
});

/** Análises referenciadas pelos elementos (para renderizar o link público sem login). */
export const analysesForDashboard = async (row: DashboardRow) => {
  const ids = new Set<string>();
  for (const element of allElements(row.doc)) {
    const dataset = (element.props as { dataset?: { source?: string; ref?: string } }).dataset;
    if (dataset?.source === "analysis" && dataset.ref) ids.add(dataset.ref);
  }
  if (ids.size === 0) return [];
  const rows = await db
    .select()
    .from(schema.analyses)
    .where(and(eq(schema.analyses.userId, row.userId), inArray(schema.analyses.id, [...ids])));
  return rows.map(toSavedAnalysis);
};
