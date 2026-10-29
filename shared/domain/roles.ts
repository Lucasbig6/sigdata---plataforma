/**
 * Papéis de acesso do SIGDATA. São cumulativos: cada papel faz tudo o que o
 * anterior faz.
 *
 * - usuario  — projetos, workspace (chat), painéis e visualizações.
 * - analista — + fontes de dados, editor SQL (tratamento) e datasets.
 * - admin    — + gestão de usuários e visão geral do sistema.
 */
export const ROLES = ["usuario", "analista", "admin"] as const;

export type Role = (typeof ROLES)[number];

export const DEFAULT_ROLE: Role = "usuario";

export const ROLE_LABELS: Record<Role, string> = {
  usuario: "Usuário",
  analista: "Analista",
  admin: "Administrador",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  usuario: "Projetos, workspace, painéis e visualizações.",
  analista: "Tudo do usuário + fontes de dados, editor SQL e datasets.",
  admin: "Tudo do analista + gestão de usuários.",
};

export const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (ROLES as readonly string[]).includes(value);

/** Papel salvo na conta; valores desconhecidos caem no mais restrito. */
export const roleOf = (value: unknown): Role => (isRole(value) ? value : DEFAULT_ROLE);

/** `role` alcança pelo menos `required` na hierarquia. */
export const hasRole = (role: unknown, required: Role) =>
  ROLES.indexOf(roleOf(role)) >= ROLES.indexOf(required);
