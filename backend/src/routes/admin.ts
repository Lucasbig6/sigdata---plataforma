import { count, eq, isNotNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AdminOverview } from "@shared/domain/admin";
import { ROLES, type Role } from "@shared/domain/roles";
import { db, schema } from "../db";
import { handle } from "../http";

/**
 * Área administrativa. A gestão de contas (criar, papel, desativar, senha, remover)
 * fica nos endpoints do plugin admin do Better Auth (/api/auth/admin/*); aqui só o
 * que é do domínio do SIGDATA.
 */
export const adminRoutes = new Hono();

/** Números gerais do sistema para a visão geral do admin. */
adminRoutes.get(
  "/overview",
  handle(async (): Promise<AdminOverview> => {
    const [byRole, [banned], sourcesByKind, [projects], [dashboards], [shared]] = await Promise.all([
      db.select({ role: schema.user.role, total: count() }).from(schema.user).groupBy(schema.user.role),
      db.select({ total: count() }).from(schema.user).where(eq(schema.user.banned, true)),
      db
        .select({ kind: schema.dataSources.kind, total: count() })
        .from(schema.dataSources)
        .groupBy(schema.dataSources.kind),
      db.select({ total: count() }).from(schema.projects),
      db.select({ total: count() }).from(schema.dashboards).where(sql`${schema.dashboards.origin} <> 'demo'`),
      db.select({ total: count() }).from(schema.dashboards).where(isNotNull(schema.dashboards.shareToken)),
    ]);

    const users = Object.fromEntries(ROLES.map((role) => [role, 0])) as Record<Role, number>;
    for (const row of byRole) if (row.role in users) users[row.role] = row.total;
    const datasets = sourcesByKind.find((row) => row.kind === "dataset")?.total ?? 0;
    const allSources = sourcesByKind.reduce((sum, row) => sum + row.total, 0);

    return {
      users: { ...users, total: Object.values(users).reduce((a, b) => a + b, 0), banned: banned.total },
      sources: allSources - datasets,
      datasets,
      projects: projects.total,
      dashboards: dashboards.total,
      sharedDashboards: shared.total,
    };
  }, { role: "admin" }),
);
