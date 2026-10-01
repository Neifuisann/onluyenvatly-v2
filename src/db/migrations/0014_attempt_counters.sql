ALTER TABLE "attempts" ADD COLUMN "counter_recorded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Earlier submit transactions already incremented these counters atomically.
UPDATE "attempts" SET "counter_recorded" = true WHERE "status" = 'submitted' AND "lesson_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "attempts_pending_counter_idx" ON "attempts" USING btree ("lesson_id") WHERE "attempts"."status" = 'submitted' and "attempts"."lesson_id" is not null and not "attempts"."counter_recorded";
