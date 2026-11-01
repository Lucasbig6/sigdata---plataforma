import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { toRole, type Role } from "@shared/roles";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields({ user: { role: { type: "string", input: false } } })],
});

export const { signIn, signUp, signOut, useSession } = authClient;

/** Papel da pessoa logada (`null` enquanto a sessão carrega). Só decide o que mostrar: o servidor é quem valida. */
export const useRole = (): Role | null => {
  const { data } = useSession();
  return data ? toRole((data.user as { role?: unknown }).role) : null;
};
