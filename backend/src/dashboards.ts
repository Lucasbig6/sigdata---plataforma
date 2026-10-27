import { and, eq, inArray } from "drizzle-orm";
import type { SavedAnalysis } from "@shared/analyses";
import { migrateDashboard, type Dashboard } from "@shared/dashboards/types";
import { db, schema } from "./db";
import { HttpError, notFound } from "./http";

type DashboardRow = typeof schema.dashboards.$inferSelect;

export type DashboardWithShare = Dashboard & { shareToken: string | null };

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
  shareToken: row.shareToken,
});

/** Valida o documento recebido com a mesma rotina usada na leitura local. */
export const parseDashboard = (raw: unknown): Dashboard => {
  const doc = migrateDashboard(raw);
  if (!doc) throw new HttpError(400, "Documento de dashboard inválido.");
  if (doc.elements.length > 300) throw new HttpError(413, "Dashboard com elementos demais.");
  return doc;
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

/** Análises referenciadas pelos elementos (para renderizar o link público sem login). */
export const analysesForDashboard = async (row: DashboardRow) => {
  const ids = new Set<string>();
  for (const element of row.doc.elements) {
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
