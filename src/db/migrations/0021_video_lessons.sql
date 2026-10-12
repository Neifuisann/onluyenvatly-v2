ALTER TYPE "public"."attempt_mode" ADD VALUE 'video';--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "video" jsonb;