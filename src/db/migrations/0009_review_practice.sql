ALTER TABLE "attempts" ADD COLUMN "checked" smallint[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "mistakes" ADD COLUMN "question_type" text;--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_one_open_review_uq" ON "attempts" USING btree ("user_id") WHERE "attempts"."status" = 'in_progress' and "attempts"."lesson_id" is null;--> statement-breakpoint
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_question_type_check" CHECK ("mistakes"."question_type" in ('mcq', 'tf', 'short'));--> statement-breakpoint
-- Backfill: each mistake's type from the version where it was last seen.
UPDATE "mistakes" AS m SET "question_type" = q.value->>'type'
FROM "lesson_versions" AS v, jsonb_array_elements(v."questions") AS q
WHERE v."id" = m."lesson_version_id" AND q.value->>'id' = m."question_id";
