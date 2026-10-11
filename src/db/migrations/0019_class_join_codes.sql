ALTER TABLE "classes" ADD COLUMN "join_code" text;--> statement-breakpoint
-- Existing classes get a random code from the invite alphabet
-- (`features/classes/domain/invite.ts`); the correlated subquery draws per row.
UPDATE "classes" c SET "join_code" = (
  SELECT string_agg(substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 1 + floor(random() * 31)::int, 1), '')
  FROM generate_series(1, 8) WHERE c."id" IS NOT NULL
);--> statement-breakpoint
ALTER TABLE "classes" ALTER COLUMN "join_code" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "classes_join_code_uq" ON "classes" USING btree ("join_code");
