import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/test/db";
import { settings, users } from "./schema";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

describe("migrations", () => {
  it("apply cleanly and create the settings row", async () => {
    const rows = await db.select().from(settings);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 1,
      registrationOpen: true,
      singleSession: true,
    });
  });

  it("enable RLS on every table (04 §5)", async () => {
    const rows = await db.execute<{ relname: string; relrowsecurity: boolean }>(
      sql`select relname, relrowsecurity from pg_class
          where relnamespace = 'public'::regnamespace and relkind = 'r'
            and relname not like '__drizzle%'`,
    );
    expect(rows.rows.length).toBeGreaterThanOrEqual(5);
    for (const row of rows.rows)
      expect(row, row.relname).toMatchObject({ relrowsecurity: true });
  });

  it("allows only one settings row", async () => {
    await expect(db.insert(settings).values({ id: 2 })).rejects.toThrow();
  });

  it("requires a phone or a username", async () => {
    await expect(
      db.insert(users).values({ fullName: "A", passwordHash: "x" }),
    ).rejects.toThrow();
  });

  it("round-trips a typed user", async () => {
    const [created] = await db
      .insert(users)
      .values({
        fullName: "Học Sinh",
        phone: "0912345678",
        passwordHash: "x",
        grade: 12,
      })
      .returning();
    const found = await db.query.users.findFirst({
      where: eq(users.id, created?.id ?? ""),
    });
    expect(found).toMatchObject({
      role: "student",
      status: "pending",
      grade: 12,
    });
  });
});
