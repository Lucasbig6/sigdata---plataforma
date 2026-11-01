import { eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { adminCreationRole, openSignup, rememberAccessLink } from "./access";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "./db";
import { mailerConfigured, sendMail } from "./mailer";
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
    // também vale para o link de primeiro acesso enviado pelo admin
    resetPasswordTokenExpiresIn: 60 * 60 * 24,
    // não bloqueia a requisição esperando o provedor de e-mail
    sendResetPassword: async ({ user, url }) => {
      rememberAccessLink(user.email, url);
      void sendMail({
        to: user.email,
        subject: "Redefinir sua senha no SIGDATA",
        text: `Olá, ${user.name}.\n\nPara criar uma nova senha, abra o link (vale por 24 horas):\n${url}\n\nSe você não pediu isso, ignore este e-mail.`,
      }).catch((error) => console.error("[sigdata] falha ao enviar e-mail", error));
    },
    revokeSessionsOnPasswordReset: true,
  },
  // só envia o e-mail de confirmação se houver provedor; o acesso não depende dele
  ...(mailerConfigured() && {
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }: { user: { email: string; name: string }; url: string }) => {
        void sendMail({
          to: user.email,
          subject: "Confirme seu e-mail no SIGDATA",
          text: `Olá, ${user.name}.\n\nConfirme seu e-mail abrindo o link:\n${url}`,
        }).catch((error) => console.error("[sigdata] falha ao enviar e-mail", error));
      },
    },
  }),
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  // desligado só nos testes, que criam várias contas em sequência
  rateLimit: { enabled: process.env.SIGDATA_TEST !== "1", window: 60, max: 30 },
  user: {
    // `input: false`: o papel nunca vem do cadastro nem da edição de perfil, só do admin
    additionalFields: { role: { type: "string", defaultValue: "usuario", input: false } },
  },
  databaseHooks: {
    session: {
      create: {
        // conta desativada não abre sessão nova (as abertas são encerradas ao desativar)
        before: async (created) => {
          const [owner] = await db
            .select({ disabled: schema.user.disabled })
            .from(schema.user)
            .where(eq(schema.user.id, created.userId));
          if (owner?.disabled) {
            throw new APIError("FORBIDDEN", { message: "Conta desativada. Fale com um administrador." });
          }
          return { data: created };
        },
      },
    },
    user: {
      create: {
        // a primeira conta criada administra o sistema; as demais entram como usuário
        before: async (created) => {
          const [first] = await db.select({ id: schema.user.id }).from(schema.user).limit(1);
          if (!first) return { data: { ...created, role: "admin" } };
          const byAdmin = adminCreationRole(created.email);
          if (!byAdmin && !openSignup()) {
            throw new APIError("FORBIDDEN", { message: "Cadastro fechado. Peça a um administrador para criar sua conta." });
          }
          return { data: { ...created, role: byAdmin ?? "usuario" } };
        },
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
