import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
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
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: { enabled: true, window: 60, max: 30 },
  databaseHooks: {
    user: {
      create: {
        // Conteúdo inicial: fonte de demonstração consultável + dashboards de exemplo.
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
