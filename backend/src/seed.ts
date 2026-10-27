import { randomUUID } from "node:crypto";
import type { DashboardDoc } from "./db/schema";
import { db, schema } from "./db";
import demoDashboards from "./seed/demo-dashboards.json" with { type: "json" };
import { createDemoSource } from "./sources/service";

/** Conteúdo inicial de cada conta nova. */
export const seedNewUser = async (userId: string) => {
  await createDemoSource(userId);
  // fixture estática dos exemplos (elementos no formato de shared/dashboards/types)
  const demos = demoDashboards as unknown as (DashboardDoc & { name: string; description: string })[];
  if (demos.length === 0) return;
  await db.insert(schema.dashboards).values(
    demos.map((dashboard) => ({
      id: `db-${randomUUID().slice(0, 12)}`,
      userId,
      name: dashboard.name,
      description: dashboard.description,
      origin: "demo" as const,
      doc: {
        schemaVersion: dashboard.schemaVersion,
        canvas: dashboard.canvas,
        elements: dashboard.elements,
      },
    })),
  );
};
