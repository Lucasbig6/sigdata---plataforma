import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
import { adminAc, defaultAc } from "better-auth/plugins/admin/access";
import { hasRole, roleOf, type Role } from "@shared/domain/roles";

/** Mesmos papéis do servidor (backend/src/auth.ts): só o admin gere contas. */
const roles = {
  admin: adminAc,
  analista: defaultAc.newRole({ user: [], session: [] }),
  usuario: defaultAc.newRole({ user: [], session: [] }),
} satisfies Record<Role, unknown>;

export const authClient = createAuthClient({ plugins: [adminClient({ roles })] });

export const { signIn, signOut, useSession } = authClient;

/** Papel do usuário logado (`null` enquanto a sessão carrega). */
export const useRole = (): Role | null => {
  const { data } = useSession();
  return data ? roleOf(data.user.role) : null;
};

/**
 * O usuário logado alcança `required`? Enquanto a sessão carrega devolve `false`:
 * ações restritas só aparecem depois de confirmadas (o backend valida de novo).
 */
export const useCan = (required: Role) => {
  const role = useRole();
  return role !== null && hasRole(role, required);
};
