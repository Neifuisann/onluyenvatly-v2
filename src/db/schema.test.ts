import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/test/db";
import { lessons, lessonVersions, settings, users } from "./schema";

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
    await roundTripUser();
  });
});

describe("lessons (S2-01)", () => {
  const search = (q: string) =>
    db.execute<{ id: number; title: string }>(
      sql`select id, title from lessons
          where search_text ilike '%' || lower(immutable_unaccent(${q})) || '%'
          order by id`,
    );

  beforeAll(async () => {
    await db.insert(lessons).values([
      {
        title: "Đề ôn GK1 – Dao động cơ",
        description: "Con lắc lò xo, con lắc đơn",
        tags: ["giữa kì", "Lớp 12"],
        config: {},
      },
      {
        title: "Sóng cơ và sự truyền sóng",
        description: null,
        tags: ["Điện trường"],
        config: {},
      },
      ...Array.from({ length: 200 }, (_, i) => ({
        title: `Bài tập số ${i}`,
        config: {},
      })),
    ]);
  });

  it("generates an accent-free, lowercase search_text", async () => {
    const [row] = await db
      .select({ searchText: lessons.searchText })
      .from(lessons)
      .where(eq(lessons.id, 1));
    expect(row?.searchText).toBe(
      "de on gk1 - dao dong co con lac lo xo, con lac don giua ki lop 12",
    );
  });

  it("searches accent- and case-insensitively, including tags", async () => {
    expect((await search("dao dong")).rows.map((r) => r.id)).toEqual([1]);
    expect((await search("DAO ĐỘNG")).rows.map((r) => r.id)).toEqual([1]);
    expect((await search("lò xo")).rows.map((r) => r.id)).toEqual([1]);
    expect((await search("dien truong")).rows.map((r) => r.id)).toEqual([2]);
    expect((await search("khong co")).rows).toHaveLength(0);
  });

  it("serves the search from the trigram index", async () => {
    // The table is tiny, so force the planner off sequential scans to prove
    // the index is usable for this exact predicate.
    await db.execute(sql`set enable_seqscan = off`);
    const plan = await db.execute<{ "QUERY PLAN": string }>(
      sql`explain select id from lessons
          where search_text ilike '%' || lower(immutable_unaccent('dao dong')) || '%'`,
    );
    await db.execute(sql`reset enable_seqscan`);
    const text = plan.rows.map((r) => r["QUERY PLAN"]).join("\n");
    expect(text).toContain("lessons_search_text_trgm_idx");
  });

  it("keeps one row per (lesson, version) and cascades on delete", async () => {
    const [lesson] = await db
      .insert(lessons)
      .values({ title: "Tạm", config: {} })
      .returning({ id: lessons.id });
    const lessonId = lesson?.id ?? 0;
    const [v1] = await db
      .insert(lessonVersions)
      .values({ lessonId, version: 1, sourceText: "", questions: [] })
      .returning({ id: lessonVersions.id });
    await expect(
      db
        .insert(lessonVersions)
        .values({ lessonId, version: 1, sourceText: "", questions: [] }),
    ).rejects.toThrow();
    await db
      .update(lessons)
      .set({ currentVersionId: v1?.id ?? 0 })
      .where(eq(lessons.id, lessonId));
    await db.delete(lessons).where(eq(lessons.id, lessonId));
    const left = await db
      .select()
      .from(lessonVersions)
      .where(eq(lessonVersions.lessonId, lessonId));
    expect(left).toHaveLength(0);
  });

  it("rejects grades outside 10–12", async () => {
    await expect(
      db.insert(lessons).values({ title: "X", grade: 9, config: {} }),
    ).rejects.toThrow();
  });
});

async function roundTripUser() {
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
}
