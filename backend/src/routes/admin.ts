import { randomBytes } from "node:crypto";
import { count, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { ROLES } from "@shared/roles";
import { captureAccessLink, withAdminCreation } from "../access";
import { auth } from "../auth";
import { db, schema } from "../db";
import { handle, HttpError, notFound, parseBody } from "../http";

/** Gerenciamento de usuários: só o administrador. */
export const adminRoutes = new Hono();

const adminOnly = <P extends Record<string, string> = Record<string, string>>(
  fn: Parameters<typeof handle<P>>[0],
) => handle<P>(fn, { roles: ["admin"] });

/**
 * Lista contas com contagens (projetos, dashboards, fontes). O admin vê que o conteúdo
 * existe, mas não o abre: projetos e dashboards seguem privados de cada pessoa.
 */
adminRoutes.get(
  "/users",
  adminOnly(async () => {
    const rows = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        role: schema.user.role,
        createdAt: schema.user.createdAt,
        projects: sql<number>`(select count(*)::int from ${schema.projects} p where p.user_id = "user"."id")`,
        dashboards: sql<number>`(select count(*)::int from ${schema.dashboards} d where d.user_id = "user"."id")`,
        sources: sql<number>`(select count(*)::int from ${schema.dataSources} s where s.user_id = "user"."id" and s.kind <> 'demo')`,
      })
      .from(schema.user)
      .orderBy(schema.user.createdAt);
    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  }),
);

const redirectTo = () => `${process.env.BETTER_AUTH_URL}/redefinir-senha`;

/** Link para a pessoa definir a própria senha (vale 24 h). Também é enviado por e-mail, se houver provedor. */
const issueAccessLink = (email: string) =>
  captureAccessLink(email, () => auth.api.requestPasswordReset({ body: { email, redirectTo: redirectTo() } }));

/** Cria uma conta sem senha conhecida; a pessoa define a senha pelo link devolvido. */
adminRoutes.post(
  "/users",
  adminOnly(async ({ req }) => {
    const body = await parseBody(
      req,
      z.object({
        name: z.string().trim().min(1, "Informe o nome.").max(80),
        email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")),
        role: z.enum(ROLES).default("usuario"),
      }),
    );
    const [existing] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, body.email));
    if (existing) throw new HttpError(409, "Já existe uma conta com este e-mail.");

    const ctx = await auth.$context;
    const created = await withAdminCreation(body.email, body.role, () =>
      ctx.internalAdapter.createUser({ name: body.name, email: body.email, emailVerified: false }, { method: "admin" }),
    );
    // senha aleatória e descartada: o acesso é só pelo link de primeiro acesso
    await ctx.internalAdapter.linkAccount({
      userId: created.id,
      providerId: "credential",
      accountId: created.id,
      password: await ctx.password.hash(randomBytes(24).toString("base64url")),
    });
    const accessLink = await issueAccessLink(body.email);
    return { id: created.id, name: body.name, email: body.email, role: body.role, accessLink };
  }),
);

/** Novo link de acesso (primeiro acesso ou senha esquecida) para uma conta existente. */
adminRoutes.post(
  "/users/:id/access-link",
  adminOnly<{ id: string }>(async ({ params }) => {
    const [target] = await db.select().from(schema.user).where(eq(schema.user.id, params.id));
    if (!target) throw notFound("Usuário");
    return { accessLink: await issueAccessLink(target.email) };
  }),
);

adminRoutes.patch(
  "/users/:id",
  adminOnly<{ id: string }>(async ({ req, params }) => {
    const { role } = await parseBody(req, z.object({ role: z.enum(ROLES) }));
    const [target] = await db.select().from(schema.user).where(eq(schema.user.id, params.id));
    if (!target) throw notFound("Usuário");
    if (target.role === "admin" && role !== "admin") {
      const [{ total }] = await db
        .select({ total: count() })
        .from(schema.user)
        .where(eq(schema.user.role, "admin"));
      if ((total ?? 0) <= 1) throw new HttpError(409, "Precisa existir ao menos um administrador.");
    }
    await db.update(schema.user).set({ role }).where(eq(schema.user.id, params.id));
    return { id: target.id, role };
  }),
);
