CREATE TABLE "sync_rows" (
	"user_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"id" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"data" jsonb NOT NULL,
	"seq" bigint NOT NULL,
	CONSTRAINT "sync_rows_user_id_entity_id_pk" PRIMARY KEY("user_id","entity","id")
);
--> statement-breakpoint
ALTER TABLE "sync_rows" ADD CONSTRAINT "sync_rows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sync_rows_user_seq" ON "sync_rows" USING btree ("user_id","seq");--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "sync_seq" AS bigint START 1;
