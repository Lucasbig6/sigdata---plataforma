ALTER TABLE "data_sources" ADD COLUMN "published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'usuario' NOT NULL;--> statement-breakpoint
-- Contas já existentes mantêm o que podiam fazer: a mais antiga vira administradora e as demais analistas.
UPDATE "user" SET "role" = 'analista';
--> statement-breakpoint
UPDATE "user" SET "role" = 'admin' WHERE "id" = (SELECT "id" FROM "user" ORDER BY "created_at" ASC LIMIT 1);
