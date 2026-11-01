import { randomUUID } from "node:crypto";
import type { DashboardDoc } from "./db/schema";
import { db, schema } from "./db";
import demoDashboards from "./seed/demo-dashboards.json" with { type: "json" };
import { createDemoSource } from "./sources/service";

/** Conteúdo inicial de cada conta nova. */
/** Conteúdo de demonstração em contas novas: padrão ligado fora de produção (SIGDATA_SEED_DEMO=true|false). */
export const seedDemoEnabled = () =>
  process.env.SIGDATA_SEED_DEMO ? process.env.SIGDATA_SEED_DEMO === "true" : process.env.NODE_ENV !== "production";

export const seedNewUser = async (userId: string) => {
  if (!seedDemoEnabled()) return;
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
