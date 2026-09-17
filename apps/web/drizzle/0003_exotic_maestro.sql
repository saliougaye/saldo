CREATE TABLE "data_epochs" (
	"user_id" text PRIMARY KEY NOT NULL,
	"epoch" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "data_epochs" ADD CONSTRAINT "data_epochs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;