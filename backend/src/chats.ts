import { and, desc, eq } from "drizzle-orm";
import type { UIMessage } from "ai";
import { DEFAULT_CHAT_TITLE, DEFAULT_NOTEBOOK_TITLE, titleFromQuestion, type Chat } from "@shared/notebook";
import { db, schema } from "./db";
import { notFound } from "./http";

type ChatRow = typeof schema.chats.$inferSelect;

export const toChat = (row: ChatRow): Chat => ({
  id: row.id,
  projectId: row.projectId,
  title: row.title,
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt.getTime(),
});

export const listChats = (projectId: string) =>
  db.select().from(schema.chats).where(eq(schema.chats.projectId, projectId)).orderBy(desc(schema.chats.updatedAt));

/** Conversa do projeto, ou 404 (inclusive quando o id existe em outro projeto). */
export const getChat = async (projectId: string, chatId: string) => {
  const [row] = await db
    .select()
    .from(schema.chats)
    .where(and(eq(schema.chats.id, chatId), eq(schema.chats.projectId, projectId)));
  if (!row) throw notFound("Conversa", "a");
  return row;
};

/** Cria a conversa se ainda não existe (o id nasce no cliente); nunca "rouba" um id de outro projeto. */
export const ensureChat = async (projectId: string, chatId: string, title = DEFAULT_CHAT_TITLE) => {
  await db.insert(schema.chats).values({ id: chatId, projectId, title }).onConflictDoNothing();
  return getChat(projectId, chatId);
};

const firstQuestion = (messages: UIMessage[]) => {
  const first = messages.find((message) => message.role === "user");
  const text = first?.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join(" ");
  return text ? titleFromQuestion(text) : "";
};

/**
 * Arquivos anexados chegam como data URL (podem ter vários MB). No banco guardamos
 * só a referência; o conteúdo já foi usado na resposta.
 */
const stripInlineFiles = (message: UIMessage): UIMessage => ({
  ...message,
  parts: message.parts.map((part) =>
    part.type === "file" && part.url.startsWith("data:") ? { ...part, url: "" } : part,
  ),
});

/**
 * Substitui o histórico da conversa pela versão final. A primeira pergunta dá o título à
 * conversa e, se o projeto ainda não foi nomeado, também a ele.
 */
export const persistConversation = async (projectId: string, chatId: string, messages: UIMessage[]) => {
  const question = firstQuestion(messages);
  await db.transaction(async (tx) => {
    await tx.delete(schema.messages).where(eq(schema.messages.chatId, chatId));
    if (messages.length > 0) {
      await tx.insert(schema.messages).values(
        messages.map((message, position) => {
          const clean = stripInlineFiles(message);
          return {
            chatId,
            id: clean.id || `m-${position}`,
            position,
            role: clean.role,
            parts: clean.parts,
            metadata: clean.metadata ?? null,
          };
        }),
      );
    }
    const now = new Date();
    await tx
      .update(schema.chats)
      .set({ updatedAt: now })
      .where(eq(schema.chats.id, chatId));
    if (question) {
      await tx
        .update(schema.chats)
        .set({ title: question })
        .where(and(eq(schema.chats.id, chatId), eq(schema.chats.title, DEFAULT_CHAT_TITLE)));
      await tx
        .update(schema.projects)
        .set({ title: question })
        .where(and(eq(schema.projects.id, projectId), eq(schema.projects.title, DEFAULT_NOTEBOOK_TITLE)));
    }
    await tx.update(schema.projects).set({ updatedAt: now }).where(eq(schema.projects.id, projectId));
  });
};
