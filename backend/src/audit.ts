import { randomUUID } from "node:crypto";
import { db, schema } from "./db";

/** Quem fez a ação (nome guardado junto: o registro sobrevive à remoção da conta). */
export type AuditActor = { id: string; name: string };

/**
 * Registra uma atividade sensível. Nunca derruba a requisição: se o registro falhar,
 * só aparece no log do servidor.
 */
export const audit = async (actor: AuditActor, action: string, target = "", detail = "") => {
  try {
    await db.insert(schema.auditLog).values({
      id: randomUUID(),
      actorId: actor.id,
      actorName: actor.name,
      action,
      target: target.slice(0, 200),
      detail: detail.slice(0, 500),
    });
  } catch (error) {
    console.error("[sigdata] falha ao registrar atividade", error);
  }
};
