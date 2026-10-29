/**
 * Área administrativa: contas (plugin admin do Better Auth, /api/auth/admin/*) e
 * a visão geral do sistema (/api/admin/overview). Só o admin chega aqui; o
 * backend recusa os demais.
 */
import { create } from "zustand";
import type { AdminOverview } from "@shared/domain/admin";
import { roleOf, type Role } from "@shared/domain/roles";
import { api } from "@/lib/api/client";
import { authClient } from "@/lib/auth-client";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  banned: boolean;
  createdAt: string;
};

type AuthResult<T> = { data: T | null; error: { message?: string; code?: string; status?: number } | null };

const ERROR_MESSAGES: Record<string, string> = {
  USER_ALREADY_EXISTS: "Já existe uma conta com este e-mail.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Já existe uma conta com este e-mail.",
  PASSWORD_TOO_SHORT: "A senha precisa ter pelo menos 8 caracteres.",
  PASSWORD_TOO_LONG: "Senha longa demais.",
  INVALID_EMAIL: "E-mail inválido.",
  YOU_CANNOT_BAN_YOURSELF: "Você não pode desativar a própria conta.",
  YOU_CANNOT_REMOVE_YOURSELF: "Você não pode remover a própria conta.",
};

/** Resposta do cliente do Better Auth → dado ou erro com mensagem em português. */
const unwrap = async <T>(call: Promise<AuthResult<T>>): Promise<T> => {
  const { data, error } = await call;
  if (error || data === null) {
    const known = error?.code ? ERROR_MESSAGES[error.code] : undefined;
    throw new Error(
      known ?? (error?.status === 403 ? "Apenas administradores podem fazer isso." : error?.message) ?? "Falha na operação.",
    );
  }
  return data;
};

type RawUser = { id: string; name: string; email: string; role?: string | null; banned?: boolean | null; createdAt: Date | string };

const toAdminUser = (user: RawUser): AdminUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: roleOf(user.role),
  banned: Boolean(user.banned),
  createdAt: new Date(user.createdAt).toISOString(),
});

type AdminStore = {
  hydrated: boolean;
  error: string | null;
  users: AdminUser[];
  overview: AdminOverview | null;

  reload: () => Promise<void>;
  createUser: (input: { name: string; email: string; password: string; role: Role }) => Promise<void>;
  setRole: (userId: string, role: Role) => Promise<void>;
  setActive: (userId: string, active: boolean) => Promise<void>;
  setPassword: (userId: string, password: string) => Promise<void>;
  removeUser: (userId: string) => Promise<void>;
};

export const useAdminStore = create<AdminStore>((set, get) => {
  const patchUser = (userId: string, patch: Partial<AdminUser>) =>
    set({ users: get().users.map((user) => (user.id === userId ? { ...user, ...patch } : user)) });

  /** Contagens mudam com papel, status e contas: atualiza em segundo plano. */
  const refreshOverview = () =>
    api<AdminOverview>("/api/admin/overview")
      .then((overview) => set({ overview }))
      .catch(() => undefined);

  return {
    hydrated: false,
    error: null,
    users: [],
    overview: null,

    reload: async () => {
      try {
        const [list, overview] = await Promise.all([
          unwrap(authClient.admin.listUsers({ query: { limit: 500, sortBy: "createdAt", sortDirection: "asc" } })),
          api<AdminOverview>("/api/admin/overview"),
        ]);
        set({ users: list.users.map(toAdminUser), overview, hydrated: true, error: null });
      } catch (error) {
        set({ hydrated: true, error: (error as Error).message });
      }
    },

    createUser: async (input) => {
      const { user } = await unwrap(
        authClient.admin.createUser({
          name: input.name.trim(),
          email: input.email.trim(),
          password: input.password,
          role: input.role,
        }),
      );
      set({ users: [...get().users, toAdminUser(user)] });
      void refreshOverview();
    },

    setRole: async (userId, role) => {
      await unwrap(authClient.admin.setRole({ userId, role }));
      patchUser(userId, { role });
      void refreshOverview();
    },

    setActive: async (userId, active) => {
      await unwrap(active ? authClient.admin.unbanUser({ userId }) : authClient.admin.banUser({ userId }));
      patchUser(userId, { banned: !active });
      void refreshOverview();
    },

    setPassword: async (userId, password) => {
      await unwrap(authClient.admin.setUserPassword({ userId, newPassword: password }));
    },

    removeUser: async (userId) => {
      await unwrap(authClient.admin.removeUser({ userId }));
      set({ users: get().users.filter((user) => user.id !== userId) });
      void refreshOverview();
    },
  };
});
