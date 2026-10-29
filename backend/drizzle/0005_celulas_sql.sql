CREATE TABLE "notebook_cells" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"after_message_id" text,
	"position" integer DEFAULT 0 NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"sql" text DEFAULT '' NOT NULL,
	"source_id" text,
	"result_id" text,
	"run_number" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notebook_cells" ADD CONSTRAINT "notebook_cells_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notebook_cells" ADD CONSTRAINT "notebook_cells_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notebook_cells" ADD CONSTRAINT "notebook_cells_result_id_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notebook_cells_project_idx" ON "notebook_cells" USING btree ("project_id","created_at");