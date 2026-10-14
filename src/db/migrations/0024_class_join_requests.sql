CREATE TYPE "public"."class_member_status" AS ENUM('pending', 'active');--> statement-breakpoint
ALTER TABLE "class_members" ADD COLUMN "status" "class_member_status" DEFAULT 'active' NOT NULL;