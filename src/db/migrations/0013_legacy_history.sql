ALTER TABLE "lesson_versions" ADD COLUMN "legacy_hash" text;--> statement-breakpoint
ALTER TABLE "rating_events" ADD COLUMN "legacy_history_id" text;--> statement-breakpoint
ALTER TABLE "lesson_versions" ADD CONSTRAINT "lesson_versions_legacy_hash_uq" UNIQUE("lesson_id","legacy_hash");--> statement-breakpoint
ALTER TABLE "rating_events" ADD CONSTRAINT "rating_events_legacy_history_id_unique" UNIQUE("legacy_history_id");