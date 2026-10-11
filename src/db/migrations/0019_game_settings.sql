ALTER TABLE "game_players" ADD COLUMN "misses" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_players" ADD COLUMN "eliminated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "game_rooms" ADD COLUMN "same_question" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "game_rooms" ADD COLUMN "lock_join" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "game_rooms" ADD COLUMN "lives" smallint;--> statement-breakpoint
ALTER TABLE "game_rooms" ADD CONSTRAINT "game_rooms_lives_check" CHECK ("game_rooms"."lives" is null or "game_rooms"."lives" between 1 and 5);