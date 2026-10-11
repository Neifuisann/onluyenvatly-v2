ALTER TYPE "public"."attempt_mode" ADD VALUE 'game';--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "game" jsonb;