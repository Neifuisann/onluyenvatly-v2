ALTER TABLE "game_players" ADD COLUMN "zombie" jsonb;--> statement-breakpoint
ALTER TABLE "game_rooms" ADD COLUMN "mode" text DEFAULT 'race' NOT NULL;--> statement-breakpoint
ALTER TABLE "game_rooms" ADD COLUMN "seconds" smallint;--> statement-breakpoint
ALTER TABLE "game_rooms" ADD COLUMN "waves" smallint;--> statement-breakpoint
ALTER TABLE "game_rooms" ADD CONSTRAINT "game_rooms_mode_check" CHECK ("game_rooms"."mode" = 'race' or ("game_rooms"."mode" = 'zombie' and "game_rooms"."lives" in (1, 3) and "game_rooms"."waves" > 0));