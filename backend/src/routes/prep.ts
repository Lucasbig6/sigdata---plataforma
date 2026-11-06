import { Hono } from "hono";
import { z } from "zod";
import { handle, parseBody } from "../http";
import { EDITOR_PAGE_SIZES } from "../sources/service";
import { workspaceBodySchema } from "../sources/schemas";
import { distinctWorkspaceValues, profileWorkspace, runWorkspace } from "../sources/workspace";

/** Preparação de dados: só analistas e administradores, como o editor SQL. */
const analystHandle = (fn: Parameters<typeof handle>[0]) => handle(fn, { roles: ["analista", "admin"] });

export const prepRoutes = new Hono();

/** Prévia paginada do resultado das etapas. Nada é gravado em nenhuma fonte. */
prepRoutes.post(
  "/run",
  analystHandle(async ({ req, user }) => {
    const body = await parseBody(
      req,
      workspaceBodySchema.extend({
        page: z.number().int().min(1).max(100_000).default(1),
        pageSize: z
          .number()
          .int()
          .refine((size) => (EDITOR_PAGE_SIZES as readonly number[]).includes(size), "Tamanho de página inválido.")
          .default(100),
        count: z.boolean().default(false),
      }),
    );
    return runWorkspace(user.id, body);
  }),
);

/** Perfil das colunas do resultado até a etapa pedida. */
prepRoutes.post(
  "/profile",
  analystHandle(async ({ req, user }) => profileWorkspace(user.id, await parseBody(req, workspaceBodySchema))),
);

/** Valores distintos de uma coluna (até 50), para filtrar por valores e dinamizar. */
prepRoutes.post(
  "/values",
  analystHandle(async ({ req, user }) =>
    distinctWorkspaceValues(user.id, await parseBody(req, workspaceBodySchema.extend({ column: z.string().min(1).max(128) }))),
  ),
);
