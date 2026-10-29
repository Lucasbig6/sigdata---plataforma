ALTER TABLE "data_sources" DROP CONSTRAINT "data_sources_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "data_sources" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "data_sources" ADD CONSTRAINT "data_sources_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;