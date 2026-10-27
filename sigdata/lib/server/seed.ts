import "server-only";
import { randomUUID } from "node:crypto";
import { createDemoDashboards } from "@/lib/dashboards/demo-dashboards";
import { db, schema } from "./db";
import { createDemoSource } from "./sources/service";

/** Conteúdo inicial de cada conta nova. */
export const seedNewUser = async (userId: string) => {
  await createDemoSource(userId);
  const demos = createDemoDashboards();
  if (demos.length === 0) return;
  await db.insert(schema.dashboards).values(
    demos.map((dashboard) => ({
      // ids das demos são fixos; prefixo evita colisão entre usuários
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
