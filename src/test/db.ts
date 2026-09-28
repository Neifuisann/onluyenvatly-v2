/**
 * Integration-test database: an in-process Postgres (PGlite) with the real
 * migrations applied. No Docker needed, so it runs the same locally and in CI.
 *
 * Use it by mocking the app's db module:
 *   vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
 */
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";

export async function createTestDb() {
  const client = new PGlite();
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
    sql`truncate table audit_log, rate_limits, sessions, users restart identity cascade`,
  );
  await db.execute(sql`delete from settings`);
  await db.execute(sql`insert into settings (id) values (1)`);
}
