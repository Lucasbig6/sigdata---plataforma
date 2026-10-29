ALTER TABLE "session" ADD COLUMN "impersonated_by" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'usuario' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ban_expires" timestamp with time zone;--> statement-breakpoint
-- Instalações existentes: a conta mais antiga vira admin (o cadastro público deixa de existir).
UPDATE "user" SET "role" = 'admin' WHERE "id" = (SELECT "id" FROM "user" ORDER BY "created_at" LIMIT 1);--> statement-breakpoint
-- Fontes viram catálogo comum: as fontes de demonstração (uma por conta) passam a ser uma só.
UPDATE "projects" SET "source_id" = (SELECT "id" FROM "data_sources" WHERE "kind" = 'demo' ORDER BY "created_at" LIMIT 1)
WHERE "source_id" IN (SELECT "id" FROM "data_sources" WHERE "kind" = 'demo');--> statement-breakpoint
UPDATE "results" SET "source_id" = (SELECT "id" FROM "data_sources" WHERE "kind" = 'demo' ORDER BY "created_at" LIMIT 1)
WHERE "source_id" IN (SELECT "id" FROM "data_sources" WHERE "kind" = 'demo');--> statement-breakpoint
DELETE FROM "data_sources" WHERE "kind" = 'demo'
AND "id" <> (SELECT "id" FROM "data_sources" WHERE "kind" = 'demo' ORDER BY "created_at" LIMIT 1);
