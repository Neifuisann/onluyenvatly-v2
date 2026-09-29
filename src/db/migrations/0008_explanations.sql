CREATE TYPE "public"."explanation_source" AS ENUM('ai', 'teacher');--> statement-breakpoint
CREATE TABLE "explanation_votes" (
	"question_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"up" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "explanation_votes_question_hash_user_id_pk" PRIMARY KEY("question_hash","user_id")
);
--> statement-breakpoint
ALTER TABLE "explanation_votes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "question_explanations" (
	"question_hash" text PRIMARY KEY NOT NULL,
	"lesson_id" bigint,
	"question_id" text NOT NULL,
	"source" "explanation_source" DEFAULT 'ai' NOT NULL,
	"model" text,
	"prompt_version" text,
	"content_md" text NOT NULL,
	"votes_up" integer DEFAULT 0 NOT NULL,
	"votes_down" integer DEFAULT 0 NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "question_explanations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "explanation_votes" ADD CONSTRAINT "explanation_votes_question_hash_question_explanations_question_hash_fk" FOREIGN KEY ("question_hash") REFERENCES "public"."question_explanations"("question_hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explanation_votes" ADD CONSTRAINT "explanation_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_explanations" ADD CONSTRAINT "question_explanations_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_explanations" ADD CONSTRAINT "question_explanations_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "question_explanations_lesson_idx" ON "question_explanations" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "question_explanations_flagged_idx" ON "question_explanations" USING btree ("votes_down" DESC NULLS LAST) WHERE "question_explanations"."reviewed_at" is null and "question_explanations"."votes_down" >= 3;