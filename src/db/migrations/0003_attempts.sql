CREATE TYPE "public"."attempt_mode" AS ENUM('test', 'practice', 'review');--> statement-breakpoint
CREATE TYPE "public"."attempt_status" AS ENUM('in_progress', 'submitted', 'expired');--> statement-breakpoint
CREATE TYPE "public"."mistake_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_result_id" text,
	"user_id" uuid NOT NULL,
	"lesson_id" bigint,
	"lesson_version_id" bigint,
	"mode" "attempt_mode" DEFAULT 'test' NOT NULL,
	"status" "attempt_status" DEFAULT 'in_progress' NOT NULL,
	"items" jsonb NOT NULL,
	"answers" jsonb NOT NULL,
	"flagged" smallint[] DEFAULT '{}' NOT NULL,
	"guard_events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"earned" numeric(5, 2)[],
	"score" numeric(7, 2),
	"max_score" numeric(7, 2) NOT NULL,
	"score10" numeric(4, 2),
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"time_taken_sec" integer,
	"last_saved_at" timestamp with time zone,
	"client_submit_id" uuid,
	"ip" "inet",
	CONSTRAINT "attempts_legacy_result_id_unique" UNIQUE("legacy_result_id"),
	CONSTRAINT "attempts_answers_aligned" CHECK (jsonb_array_length("attempts"."answers") = jsonb_array_length("attempts"."items"))
);
--> statement-breakpoint
ALTER TABLE "attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "mistakes" (
	"user_id" uuid NOT NULL,
	"lesson_id" bigint NOT NULL,
	"question_id" text NOT NULL,
	"lesson_version_id" bigint NOT NULL,
	"wrong_count" smallint DEFAULT 0 NOT NULL,
	"correct_streak" smallint DEFAULT 0 NOT NULL,
	"status" "mistake_status" DEFAULT 'open' NOT NULL,
	"last_attempt_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mistakes_user_id_lesson_id_question_id_pk" PRIMARY KEY("user_id","lesson_id","question_id")
);
--> statement-breakpoint
ALTER TABLE "mistakes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rating_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rating_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"attempt_id" uuid,
	"lesson_id" bigint,
	"before" integer NOT NULL,
	"delta" integer NOT NULL,
	"after" integer NOT NULL,
	"performance" numeric(4, 3),
	"formula" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rating_events_attempt_id_unique" UNIQUE("attempt_id")
);
--> statement-breakpoint
ALTER TABLE "rating_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ratings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"rating" integer DEFAULT 1500 NOT NULL,
	"peak" integer DEFAULT 1500 NOT NULL,
	"rated_attempts" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ratings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_lesson_version_id_lesson_versions_id_fk" FOREIGN KEY ("lesson_version_id") REFERENCES "public"."lesson_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_lesson_version_id_lesson_versions_id_fk" FOREIGN KEY ("lesson_version_id") REFERENCES "public"."lesson_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_last_attempt_id_attempts_id_fk" FOREIGN KEY ("last_attempt_id") REFERENCES "public"."attempts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_events" ADD CONSTRAINT "rating_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_events" ADD CONSTRAINT "rating_events_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_events" ADD CONSTRAINT "rating_events_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_one_in_progress_uq" ON "attempts" USING btree ("user_id","lesson_id") WHERE "attempts"."status" = 'in_progress';--> statement-breakpoint
CREATE INDEX "attempts_user_submitted_idx" ON "attempts" USING btree ("user_id","submitted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "attempts_lesson_submitted_idx" ON "attempts" USING btree ("lesson_id","submitted_at" DESC NULLS LAST) WHERE "attempts"."status" = 'submitted';--> statement-breakpoint
CREATE INDEX "attempts_expiry_idx" ON "attempts" USING btree ("status","deadline_at") WHERE "attempts"."status" = 'in_progress';--> statement-breakpoint
CREATE INDEX "mistakes_user_status_idx" ON "mistakes" USING btree ("user_id","status","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "rating_events_user_created_idx" ON "rating_events" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "rating_events_created_idx" ON "rating_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ratings_rating_idx" ON "ratings" USING btree ("rating" DESC NULLS LAST);