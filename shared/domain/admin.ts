import type { Role } from "./roles";

/** Números gerais do sistema (GET /api/admin/overview). */
export type AdminOverview = {
  users: Record<Role, number> & { total: number; banned: number };
  sources: number;
  datasets: number;
  projects: number;
  dashboards: number;
  sharedDashboards: number;
};
