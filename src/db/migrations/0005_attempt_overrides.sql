CREATE TABLE "attempt_overrides" (
	"user_id" uuid NOT NULL,
	"lesson_id" bigint NOT NULL,
	"extra_attempts" smallint NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempt_overrides_user_id_lesson_id_pk" PRIMARY KEY("user_id","lesson_id"),
	CONSTRAINT "attempt_overrides_extra_check" CHECK ("attempt_overrides"."extra_attempts" between 1 and 100)
);
--> statement-breakpoint
ALTER TABLE "attempt_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attempt_overrides" ADD CONSTRAINT "attempt_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_overrides" ADD CONSTRAINT "attempt_overrides_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_overrides" ADD CONSTRAINT "attempt_overrides_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;