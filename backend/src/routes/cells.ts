import { Hono } from "hono";
import { z } from "zod";
import { createCell, deleteCell, listCells, runCell, updateCell } from "../cells";
import { handle, parseBody } from "../http";
import { getProject } from "../projects";

/**
 * Células SQL do notebook de um projeto (/api/projects/:id/cells). Qualquer perfil
 * usa: só leitura (SELECT), só em datasets, como a IA.
 */
export const cellsRoutes = new Hono();

type Params = { id: string };
type CellParams = Params & { cellId: string };

cellsRoutes.get(
  "/",
  handle<Params>(async ({ user, params }) => listCells((await getProject(user.id, params.id)).id)),
);

cellsRoutes.post(
  "/",
  handle<Params>(async ({ req, user, params }) => {
    const project = await getProject(user.id, params.id);
    const body = await parseBody(
      req,
      z.object({
        afterMessageId: z.string().max(200).nullable().default(null),
        sql: z.string().max(20_000).default(""),
        title: z.string().max(160).default(""),
      }),
    );
    return createCell(project.id, body);
  }),
);

cellsRoutes.patch(
  "/:cellId",
  handle<CellParams>(async ({ req, user, params }) => {
    const project = await getProject(user.id, params.id);
    const body = await parseBody(
      req,
      z.object({ sql: z.string().max(20_000).optional(), title: z.string().max(160).optional() }),
    );
    return updateCell(project.id, params.cellId, body);
  }),
);

cellsRoutes.delete(
  "/:cellId",
  handle<CellParams>(async ({ user, params }) => {
    await deleteCell((await getProject(user.id, params.id)).id, params.cellId);
    return { ok: true };
  }),
);

cellsRoutes.post(
  "/:cellId/run",
  handle<CellParams>(async ({ user, params }) =>
    runCell(user.id, await getProject(user.id, params.id), params.cellId),
  ),
);
