CREATE TABLE "deleted_blobs" (
	"user_id" text NOT NULL,
	"attachment_id" text NOT NULL,
	"tombstoned_at" timestamp with time zone NOT NULL,
	CONSTRAINT "deleted_blobs_user_id_attachment_id_pk" PRIMARY KEY("user_id","attachment_id")
);
--> statement-breakpoint
ALTER TABLE "deleted_blobs" ADD CONSTRAINT "deleted_blobs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deleted_blobs_due" ON "deleted_blobs" USING btree ("tombstoned_at");