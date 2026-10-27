/**
 * Schema Postgres do SIGDATA (Drizzle).
 *
 * - Tabelas `user`, `session`, `account`, `verification`: formato exigido pelo Better Auth.
 * - Demais tabelas: domínio do app. Tudo pertence a um usuário (`user_id`), e as
 *   rotas de API sempre filtram por ele.
 * - Documentos com estrutura rica (mensagens do chat, widgets, dashboards) ficam em
 *   jsonb e são validados na borda (rotas), como já era feito na leitura do localStorage.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { UIMessage } from "ai";
import type { AnalysisSnapshot } from "@/lib/dashboards/analyses";
import type { DashboardElement } from "@/lib/dashboards/types";
import type { PanelWidget } from "@/lib/panel/store";
import type { ResultColumn, SourceKind, SourceStatus, SourceTable } from "@/lib/domain/sources";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* ------------------------------------------------------------------ auth */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("account_user_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

/* --------------------------------------------------------------- domínio */

export const dataSources = pgTable(
  "data_sources",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    kind: text("kind").$type<SourceKind>().notNull(),
    status: text("status").$type<SourceStatus>().notNull().default("processando"),
    error: text("error"),
    fileName: text("file_name"),
    fileSize: integer("file_size"),
    /** Credenciais de conexão externa, criptografadas (AES-256-GCM). */
    connection: text("connection"),
    /** Cache do schema + perfil das colunas. */
    tables: jsonb("tables").$type<SourceTable[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("data_sources_user_idx").on(table.userId)],
);

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    coverIndex: integer("cover_index").notNull().default(0),
    /** Fonte de dados ativa no workspace do projeto. */
    sourceId: text("source_id").references(() => dataSources.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("projects_user_idx").on(table.userId, table.updatedAt)],
);

export const messages = pgTable(
  "messages",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    position: integer("position").notNull(),
    role: text("role").$type<UIMessage["role"]>().notNull(),
    parts: jsonb("parts").$type<UIMessage["parts"]>().notNull(),
    metadata: jsonb("metadata"),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.id] }),
    index("messages_order_idx").on(table.projectId, table.position),
  ],
);

export const projectPanels = pgTable("project_panels", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  widgets: jsonb("widgets").$type<PanelWidget[]>().notNull().default(sql`'[]'::jsonb`),
  updatedAt: updatedAt(),
});

export const results = pgTable(
  "results",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    sourceId: text("source_id").references(() => dataSources.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    sql: text("sql").notNull(),
    columns: jsonb("columns").$type<ResultColumn[]>().notNull(),
    rows: jsonb("rows").$type<Record<string, unknown>[]>().notNull(),
    rowCount: integer("row_count").notNull(),
    truncated: boolean("truncated").notNull().default(false),
    durationMs: integer("duration_ms").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [index("results_project_idx").on(table.projectId, table.createdAt)],
);

export const analyses = pgTable(
  "analyses",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    snapshot: jsonb("snapshot").$type<AnalysisSnapshot>().notNull(),
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("analyses_user_idx").on(table.userId, table.savedAt)],
);

export type DashboardDoc = {
  schemaVersion: number;
  canvas: { width: number; height: number };
  elements: DashboardElement[];
};

export const dashboards = pgTable(
  "dashboards",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    origin: text("origin").$type<"demo" | "user">().notNull().default("user"),
    doc: jsonb("doc").$type<DashboardDoc>().notNull(),
    /** Token do link público (null = não compartilhado). */
    shareToken: text("share_token"),
    sharedAt: timestamp("shared_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("dashboards_user_idx").on(table.userId, table.updatedAt),
    uniqueIndex("dashboards_share_token_idx").on(table.shareToken),
  ],
);

export const projectsRelations = relations(projects, ({ one }) => ({
  source: one(dataSources, { fields: [projects.sourceId], references: [dataSources.id] }),
}));
