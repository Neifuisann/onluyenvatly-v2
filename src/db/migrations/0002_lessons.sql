-- S2-01 (hand-written, before the generated DDL): accent-insensitive search.
-- Supabase may keep extensions in the `extensions` schema, so the helpers pin a
-- search_path that covers both it and `public` (missing schemas are ignored).
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  SET search_path = public, extensions, pg_catalog
  AS $$ SELECT unaccent('unaccent', $1) $$;--> statement-breakpoint
-- lessons.search_text. array_to_string/concat_ws are only STABLE because of
-- generic type output; for text they are immutable, which a generated column needs.
CREATE OR REPLACE FUNCTION lesson_search_text(title text, description text, tags text[]) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path = public, extensions, pg_catalog
  AS $$ SELECT lower(immutable_unaccent(concat_ws(' ', title, description, array_to_string(tags, ' ')))) $$;--> statement-breakpoint
CREATE TYPE "public"."lesson_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "lesson_versions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lesson_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"lesson_id" bigint NOT NULL,
	"version" integer NOT NULL,
	"source_text" text NOT NULL,
	"questions" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_versions_lesson_version_uq" UNIQUE("lesson_id","version")
);
--> statement-breakpoint
ALTER TABLE "lesson_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lessons_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"legacy_id" text,
	"title" text NOT NULL,
	"description" text,
	"grade" smallint,
	"chapter" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"cover_path" text,
	"status" "lesson_status" DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"current_version_id" bigint,
	"draft_version_id" bigint,
	"config" jsonb NOT NULL,
	"question_count" smallint DEFAULT 0 NOT NULL,
	"type_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"search_text" text GENERATED ALWAYS AS (lesson_search_text(title, description, tags)) STORED,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "lessons_legacy_id_unique" UNIQUE("legacy_id"),
	CONSTRAINT "lessons_grade_check" CHECK ("lessons"."grade" is null or "lessons"."grade" between 10 and 12)
);
--> statement-breakpoint
ALTER TABLE "lessons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_path_unique" UNIQUE("path")
);
--> statement-breakpoint
ALTER TABLE "media" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lesson_versions" ADD CONSTRAINT "lesson_versions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_versions" ADD CONSTRAINT "lesson_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_current_version_id_lesson_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."lesson_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_draft_version_id_lesson_versions_id_fk" FOREIGN KEY ("draft_version_id") REFERENCES "public"."lesson_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lessons_status_sort_idx" ON "lessons" USING btree ("status","sort_order");--> statement-breakpoint
CREATE INDEX "lessons_tags_idx" ON "lessons" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "lessons_search_text_trgm_idx" ON "lessons" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "users_full_name_trgm_idx" ON "users" USING gin (lower(immutable_unaccent("full_name")) gin_trgm_ops);