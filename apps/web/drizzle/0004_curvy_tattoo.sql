CREATE TABLE "server_clock" (
	"id" integer PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"wall_ms" bigint NOT NULL,
	"counter" integer NOT NULL
);
