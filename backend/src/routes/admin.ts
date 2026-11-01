import { randomBytes } from "node:crypto";
import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { ROLES } from "@shared/roles";
import { captureAccessLink, withAdminCreation } from "../access";
import { audit } from "../audit";
import { invalidateSourceCache } from "../query-cache";
import { removeDuckFiles } from "../sources/duck";
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
        disabled: schema.user.disabled,
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
  adminOnly(async ({ req, user }) => {
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
    await audit(user, "usuario.criado", body.email, body.role);
    return { id: created.id, name: body.name, email: body.email, role: body.role, accessLink };
  }),
);

/** Novo link de acesso (primeiro acesso ou senha esquecida) para uma conta existente. */
adminRoutes.post(
  "/users/:id/access-link",
  adminOnly<{ id: string }>(async ({ user, params }) => {
    const [target] = await db.select().from(schema.user).where(eq(schema.user.id, params.id));
    if (!target) throw notFound("Usuário");
    await audit(user, "usuario.link_de_acesso", target.email);
    return { accessLink: await issueAccessLink(target.email) };
  }),
);

/** Garante que sempre sobra ao menos um administrador ativo fora da conta `exceptId`. */
const assertAnotherAdmin = async (exceptId: string) => {
  const [{ total }] = await db
    .select({ total: count() })
    .from(schema.user)
    .where(and(eq(schema.user.role, "admin"), eq(schema.user.disabled, false), ne(schema.user.id, exceptId)));
  if ((total ?? 0) < 1) throw new HttpError(409, "Precisa existir ao menos um administrador ativo.");
};

adminRoutes.patch(
  "/users/:id",
  adminOnly<{ id: string }>(async ({ req, user, params }) => {
    const body = await parseBody(
      req,
      z.object({ role: z.enum(ROLES).optional(), disabled: z.boolean().optional() }),
    );
    const [target] = await db.select().from(schema.user).where(eq(schema.user.id, params.id));
    if (!target) throw notFound("Usuário");
    const losesAdmin = target.role === "admin" && ((body.role && body.role !== "admin") || body.disabled === true);
    if (losesAdmin) await assertAnotherAdmin(target.id);
    if (body.disabled && target.id === user.id) throw new HttpError(409, "Você não pode desativar a própria conta.");

    await db
      .update(schema.user)
      .set({ ...(body.role && { role: body.role }), ...(body.disabled !== undefined && { disabled: body.disabled }) })
      .where(eq(schema.user.id, params.id));
    if (body.disabled) await db.delete(schema.session).where(eq(schema.session.userId, params.id));

    if (body.role && body.role !== target.role) await audit(user, "usuario.perfil", target.email, `${target.role} → ${body.role}`);
    if (body.disabled !== undefined && body.disabled !== target.disabled) {
      await audit(user, body.disabled ? "usuario.desativado" : "usuario.reativado", target.email);
    }
    return { id: target.id, role: body.role ?? target.role, disabled: body.disabled ?? target.disabled };
  }),
);

/**
 * Remove a conta e tudo o que é só dela (projetos, dashboards, fontes). Datasets publicados
 * passam para o administrador que removeu, para não quebrar o que outras pessoas usam.
 */
adminRoutes.delete(
  "/users/:id",
  adminOnly<{ id: string }>(async ({ user, params }) => {
    const [target] = await db.select().from(schema.user).where(eq(schema.user.id, params.id));
    if (!target) throw notFound("Usuário");
    if (target.id === user.id) throw new HttpError(409, "Você não pode remover a própria conta.");
    if (target.role === "admin") await assertAnotherAdmin(target.id);

    await db
      .update(schema.dataSources)
      .set({ userId: user.id })
      .where(and(eq(schema.dataSources.userId, target.id), eq(schema.dataSources.published, true)));
    const owned = await db
      .select({ id: schema.dataSources.id, kind: schema.dataSources.kind })
      .from(schema.dataSources)
      .where(eq(schema.dataSources.userId, target.id));
    await db.delete(schema.user).where(eq(schema.user.id, target.id));
    for (const source of owned) {
      invalidateSourceCache(source.id);
      if (source.kind !== "postgresql") await removeDuckFiles(source.id).catch(() => undefined);
    }
    await audit(user, "usuario.removido", target.email);
    return { ok: true };
  }),
);

/** Registro de atividades (mais recentes primeiro). */
adminRoutes.get(
  "/audit",
  adminOnly(async ({ req }) => {
    const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 100, 500);
    const rows = await db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.at)).limit(limit);
    return rows.map((row) => ({ ...row, at: row.at.toISOString() }));
  }),
);
