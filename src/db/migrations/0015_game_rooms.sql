CREATE TYPE "public"."game_status" AS ENUM('lobby', 'running', 'finished');--> statement-breakpoint
CREATE TABLE "game_players" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "game_players_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"racer" text NOT NULL,
	"color" smallint NOT NULL,
	"seed" bigint NOT NULL,
	"answered" smallint DEFAULT 0 NOT NULL,
	"correct" smallint DEFAULT 0 NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"streak" smallint DEFAULT 0 NOT NULL,
	"best_streak" smallint DEFAULT 0 NOT NULL,
	"marks" jsonb NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_answered_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	CONSTRAINT "game_players_room_user_uq" UNIQUE("room_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "game_players" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "game_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pin" text NOT NULL,
	"host_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" "game_status" DEFAULT 'lobby' NOT NULL,
	"pace" text NOT NULL,
	"bank" jsonb NOT NULL,
	"bank_types" text[] NOT NULL,
	"lesson_ids" bigint[] NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"hard_end_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "game_rooms_pin_check" CHECK ("game_rooms"."pin" ~ '^[1-9][0-9]{5}$'),
	CONSTRAINT "game_rooms_bank_aligned" CHECK (jsonb_array_length("game_rooms"."bank") = cardinality("game_rooms"."bank_types"))
);
--> statement-breakpoint
ALTER TABLE "game_rooms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_room_id_game_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."game_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_rooms" ADD CONSTRAINT "game_rooms_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_players_user_idx" ON "game_players" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_rooms_open_pin_uq" ON "game_rooms" USING btree ("pin") WHERE "game_rooms"."status" <> 'finished';--> statement-breakpoint
CREATE INDEX "game_rooms_pin_created_idx" ON "game_rooms" USING btree ("pin","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "game_rooms_host_created_idx" ON "game_rooms" USING btree ("host_id","created_at" DESC NULLS LAST);