ALTER TABLE "users" ADD COLUMN "leaderboard_initials" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deletion_requested_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "users_deletion_requested_idx" ON "users" USING btree ("deletion_requested_at") WHERE "users"."deletion_requested_at" is not null;