CREATE TABLE "chats" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chats_project_idx" ON "chats" USING btree ("project_id","updated_at");--> statement-breakpoint
-- cada projeto que já tem mensagens vira um projeto com uma conversa (o id da conversa reaproveita o do projeto)
INSERT INTO "chats" ("id", "project_id", "title", "created_at", "updated_at")
SELECT p."id", p."id", p."title", p."created_at", p."updated_at"
FROM "projects" p
WHERE EXISTS (SELECT 1 FROM "messages" m WHERE m."project_id" = p."id");--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "chat_id" text;--> statement-breakpoint
UPDATE "messages" SET "chat_id" = "project_id";--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "chat_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_project_id_id_pk";--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_project_id_projects_id_fk";--> statement-breakpoint
DROP INDEX "messages_order_idx";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_id_pk" PRIMARY KEY ("chat_id","id");--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_order_idx" ON "messages" USING btree ("chat_id","position");
