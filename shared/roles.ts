/**
 * Papéis de acesso.
 * - usuario: cria projetos e dashboards próprios e usa os datasets publicados.
 * - analista: além disso, importa fontes, escreve SQL e cria/publica datasets.
 * - admin: gerencia usuários e papéis e todas as fontes e datasets.
 */
export const ROLES = ["usuario", "analista", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  usuario: "Usuário",
  analista: "Analista",
  admin: "Administrador",
};

export const isRole = (value: unknown): value is Role => ROLES.includes(value as Role);

/** Valor desconhecido (ex.: sessão antiga) vira o papel de menor acesso. */
export const toRole = (value: unknown): Role => (isRole(value) ? value : "usuario");

/** Papéis que gerenciam fontes e datasets (para guardas de página e de rota). */
export const DATA_ROLES: readonly Role[] = ["analista", "admin"];

/** Fontes de dados, editor SQL e criação/publicação de datasets. */
export const canManageData = (role: Role) => role === "analista" || role === "admin";

export const canManageUsers = (role: Role) => role === "admin";
