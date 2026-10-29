import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { adminAc, defaultAc } from "better-auth/plugins/admin/access";
import { DEFAULT_ROLE } from "@shared/domain/roles";
import { db, schema } from "./db";
import { seedNewUser } from "./seed";

export const auth = betterAuth({
  appName: "SIGDATA",
  // URL pública (a do frontend): o navegador fala com o backend via /api do Next.
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: (process.env.TRUSTED_ORIGINS ?? process.env.BETTER_AUTH_URL ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    // Contas são criadas pelo admin (plugin admin → /auth/admin/create-user).
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  plugins: [
    admin({
      // Só o admin gere contas; analista e usuário não têm permissões no plugin.
      roles: {
        admin: adminAc,
        analista: defaultAc.newRole({ user: [], session: [] }),
        usuario: defaultAc.newRole({ user: [], session: [] }),
      },
      adminRoles: ["admin"],
      defaultRole: DEFAULT_ROLE,
      bannedUserMessage: "Esta conta foi desativada. Fale com o administrador.",
    }),
  ],
  rateLimit: { enabled: true, window: 60, max: 30 },
  databaseHooks: {
    user: {
      create: {
        // Conteúdo inicial: dashboards de exemplo (e a fonte de demonstração do catálogo, se faltar).
        after: async (created) => {
          try {
            await seedNewUser(created.id);
          } catch (error) {
            console.error("[sigdata] falha ao preparar conteúdo inicial", error);
          }
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
