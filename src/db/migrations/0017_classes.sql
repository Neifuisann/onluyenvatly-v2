ALTER TYPE "public"."user_role" ADD VALUE 'teacher' BEFORE 'admin';--> statement-breakpoint
CREATE TABLE "class_lessons" (
	"class_id" bigint NOT NULL,
	"lesson_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_lessons_class_id_lesson_id_pk" PRIMARY KEY("class_id","lesson_id")
);
--> statement-breakpoint
ALTER TABLE "class_lessons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "class_members" (
	"class_id" bigint NOT NULL,
	"user_id" uuid NOT NULL,
	"added_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_members_class_id_user_id_pk" PRIMARY KEY("class_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "class_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "classes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "classes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"subject" text DEFAULT 'physics' NOT NULL,
	"grade" smallint,
	"description" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classes_grade_check" CHECK ("classes"."grade" is null or "classes"."grade" between 10 and 12),
	CONSTRAINT "classes_name_check" CHECK (char_length("classes"."name") between 1 and 80)
);
--> statement-breakpoint
ALTER TABLE "classes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "subject" text DEFAULT 'physics' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "class_lessons" ADD CONSTRAINT "class_lessons_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_lessons" ADD CONSTRAINT "class_lessons_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_members" ADD CONSTRAINT "class_members_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_members" ADD CONSTRAINT "class_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_members" ADD CONSTRAINT "class_members_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_lessons_lesson_idx" ON "class_lessons" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "class_members_user_idx" ON "class_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "classes_owner_created_idx" ON "classes" USING btree ("owner_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lessons_owner_sort_idx" ON "lessons" USING btree ("owner_id","sort_order");--> statement-breakpoint
-- B-03 backfill. Lessons belong to whoever created them; migrated lessons
-- without a creator go to the first admin.
UPDATE "lessons" SET "owner_id" = coalesce("created_by", (SELECT "id" FROM "users" WHERE "role" = 'admin' ORDER BY "created_at", "id" LIMIT 1));--> statement-breakpoint
-- Registration no longer waits for approval: students still waiting can log in.
UPDATE "users" SET "status" = 'active', "approved_at" = now(), "updated_at" = now() WHERE "status" = 'pending' AND "role" = 'student';--> statement-breakpoint
-- Students keep seeing what they saw before: one class per lesson owner,
-- holding every active student and every lesson of that owner.
INSERT INTO "classes" ("owner_id", "name") SELECT DISTINCT "owner_id", 'Lớp Vật lý' FROM "lessons" WHERE "owner_id" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
INSERT INTO "class_members" ("class_id", "user_id") SELECT c."id", u."id" FROM "classes" c CROSS JOIN "users" u WHERE u."role" = 'student' AND u."status" = 'active';--> statement-breakpoint
INSERT INTO "class_lessons" ("class_id", "lesson_id") SELECT c."id", l."id" FROM "classes" c JOIN "lessons" l ON l."owner_id" = c."owner_id" WHERE l."deleted_at" IS NULL;
