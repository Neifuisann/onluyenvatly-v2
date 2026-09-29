/**
 * Integration-test database: an in-process Postgres (PGlite) with the real
 * migrations applied. No Docker needed, so it runs the same locally and in CI.
 *
 * Use it by mocking the app's db module:
 *   vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
 */
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";

export async function createTestDb() {
  // Same extensions as Supabase/Neon (migration 0002).
  const client = new PGlite({ extensions: { pg_trgm, unaccent } });
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "src/db/migrations" });
  return db;
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

export async function mockDbModule() {
  return { db: await createTestDb() };
}

/** Empties every app table except the settings row, which is reset. */
export async function resetDb(db: TestDb) {
  await db.execute(
    sql`truncate table explanation_votes, question_explanations, mistakes, rating_events, ratings, attempts, audit_log, rate_limits, sessions, media, lesson_versions, lessons, users restart identity cascade`,
  );
  await db.execute(sql`delete from settings`);
  await db.execute(sql`insert into settings (id) values (1)`);
}
