import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { lessons, lessonVersions, users } from "@/db/schema";
import { parseLessonText } from "@/features/lessons/domain/parser";
import type { Question } from "@/features/lessons/schema";
import { createTestDb, resetDb, type TestDb } from "@/test/db";
import {
  migrateLessons,
  migrateUsers,
  renderReport,
  type V1Row,
} from "./migrate-legacy";

const HASH = `$2b$10$${"a".repeat(53)}`;
/** Synthetic v1 students: fake names and 090… numbers, no real data. */
const STUDENTS: V1Row[] = [
  {
    id: 101,
    full_name: " Nguyễn  Văn A ",
    phone_number: "+84 900 000 001",
    password_hash: HASH,
    is_approved: true,
    date_of_birth: "2008-05-01",
    created_at: "2025-09-01T00:00:00Z",
  },
  {
    id: 102,
    full_name: "Trần Thị B",
    phone_number: "0900.000.002",
    password_hash: HASH,
    is_approved: false,
    grade: "Lớp 11",
  },
  { id: 103, full_name: "C", phone_number: "123", password_hash: HASH },
  {
    id: 104,
    full_name: "D",
    phone_number: "0900000004",
    password_hash: "plain",
  },
  // Same phone as 101 after normalization.
  { id: 105, full_name: "E", phone_number: "0900000001", password_hash: HASH },
];

const SAMPLE: V1Row[] = JSON.parse(
  readFileSync("tests/fixtures/v1-sample/lessons.json", "utf8"),
);

let db: TestDb;
beforeEach(async () => {
  db ??= await createTestDb();
  await resetDb(db);
});

describe("migrateUsers", () => {
  it("upserts valid students and reports the rest by legacy id", async () => {
    const report = await migrateUsers(db, STUDENTS);
    expect(report).toMatchObject({ v1: 5, inserted: 2, updated: 0 });
    expect(report.skipped).toEqual([
      { legacyId: "103", reason: "invalid phone number" },
      { legacyId: "104", reason: "password hash is not bcrypt" },
      { legacyId: "105", reason: "phone already used by v1 student 101" },
    ]);
    const rows = await db.select().from(users).orderBy(users.legacyId);
    expect(rows).toMatchObject([
      {
        legacyId: "101",
        role: "student",
        status: "active",
        fullName: "Nguyễn Văn A",
        phone: "0900000001",
        dateOfBirth: "2008-05-01",
        passwordHash: HASH,
      },
      { legacyId: "102", status: "pending", phone: "0900000002", grade: 11 },
    ]);
    expect(rows[0]?.approvedAt).toEqual(new Date("2025-09-01T00:00:00Z"));
  });

  it("is idempotent: a re-run updates instead of duplicating", async () => {
    await migrateUsers(db, STUDENTS);
    const again = await migrateUsers(db, [
      { ...STUDENTS[1], is_approved: true },
    ]);
    expect(again).toMatchObject({ inserted: 0, updated: 1 });
    const [b] = await db.select().from(users).where(eq(users.legacyId, "102"));
    expect(b?.status).toBe("active");
    expect(await db.$count(users)).toBe(2);
  });

  it("won't take a phone owned by a v2-only account", async () => {
    await db
      .insert(users)
      .values({ fullName: "V2", phone: "0900000001", passwordHash: HASH });
    const report = await migrateUsers(db, [STUDENTS[0] ?? {}]);
    expect(report.skipped[0]?.reason).toContain("v2-only");
  });
});

describe("migrateLessons", () => {
  it("creates lessons with version 1, summaries and media jobs", async () => {
    const { report, media } = await migrateLessons(db, SAMPLE);
    expect(report).toMatchObject({
      v1: 3,
      inserted: 3,
      updated: 0,
      questionsV1: 14,
      questionsMigrated: 11,
    });
    expect(
      report.problems
        .filter((p) => p.severity === "error")
        .map((p) => [p.legacyId, p.index]),
    ).toEqual([
      ["1712000000001", 5],
      ["1712000000002", 4],
      ["1712000000003", 2],
    ]);

    const rows = await db.select().from(lessons).orderBy(lessons.legacyId);
    expect(rows.map((l) => [l.title, l.status, l.grade, l.chapter])).toEqual([
      ["Đề ôn GK1 – Dao động cơ", "published", 12, "Dao động cơ"],
      ["Sóng cơ và sự truyền sóng", "published", 12, "Sóng cơ"],
      ["Điện trường – Lớp 11", "published", 11, "Điện trường"],
    ]);
    const [gk1, song] = rows;
    expect(gk1).toMatchObject({
      description: "Con lắc lò xo, con lắc đơn. 28 câu",
      tags: ["giữa kì", "Lớp 12"],
      coverPath: "legacy/cover-gk1.png",
      sortOrder: 3,
      questionCount: 5,
      typeCounts: { mcq: 3, tf: 1, short: 1 },
    });
    // Pool byType {mcq: 2, short: 1} of 2 mcq + 1 tf + 1 short available.
    expect(song).toMatchObject({
      questionCount: 3,
      typeCounts: { mcq: 2, short: 1 },
    });

    const [version] = await db
      .select()
      .from(lessonVersions)
      .where(eq(lessonVersions.lessonId, gk1?.id ?? 0));
    expect(version?.version).toBe(1);
    expect(gk1?.currentVersionId).toBe(version?.id);
    // The stored source text parses back to the stored questions.
    const stored = version?.questions as Question[];
    const reparsed = parseLessonText(version?.sourceText ?? "", {
      previous: stored,
    });
    expect(reparsed.issues).toEqual([]);
    expect(reparsed.questions).toEqual(stored);

    expect(media.map((m) => m.path).sort()).toEqual([
      "legacy/cover-gk1.png",
      "legacy/do-thi-1.png",
      "legacy/vacuum.png",
    ]);
  });

  it("is idempotent and leaves lessons edited in v2 alone", async () => {
    await migrateLessons(db, SAMPLE);
    const [song] = await db
      .select()
      .from(lessons)
      .where(eq(lessons.legacyId, "1712000000002"));
    // Simulate a teacher saving version 2 in the editor.
    await db.insert(lessonVersions).values({
      lessonId: song?.id ?? 0,
      version: 2,
      sourceText: "",
      questions: [],
    });
    const renamed = SAMPLE.map((l) => ({ ...l, title: `${String(l.title)}!` }));
    const { report } = await migrateLessons(db, renamed);
    expect(report).toMatchObject({
      inserted: 0,
      updated: 2,
      keptV2Content: ["1712000000002"],
    });
    expect(await db.$count(lessons)).toBe(3);
    expect(await db.$count(lessonVersions)).toBe(4);
    const titles = (
      await db.select().from(lessons).orderBy(lessons.legacyId)
    ).map((l) => l.title);
    expect(titles).toEqual([
      "Đề ôn GK1 – Dao động cơ!",
      "Sóng cơ và sự truyền sóng",
      "Điện trường – Lớp 11!",
    ]);
  });

  it("keeps a lesson with no valid questions as a draft without a version", async () => {
    const { report } = await migrateLessons(db, [
      {
        id: 9,
        title: "Tự luận",
        questions: [{ type: "essay", question: "?" }],
      },
    ]);
    expect(report.problems.map((p) => p.message)).toContainEqual(
      expect.stringContaining("draft"),
    );
    const [row] = await db.select().from(lessons);
    expect(row).toMatchObject({ status: "draft", currentVersionId: null });
  });

  it("turns a base64 cover into a covers/ job", async () => {
    const { media } = await migrateLessons(db, [
      {
        id: 10,
        title: "Ảnh bìa",
        lesson_image: "data:image/jpeg;base64,AAAA",
        questions: [{ type: "number", question: "x", correct: 1 }],
      },
    ]);
    expect(media).toEqual([
      {
        source: "data:image/jpeg;base64,AAAA",
        path: "legacy/covers/lesson-10.jpg",
        lessonLegacyId: "10",
      },
    ]);
  });
});

describe("renderReport", () => {
  it("summarizes counts and never includes names or phones", async () => {
    const usersReport = await migrateUsers(db, STUDENTS);
    const { report } = await migrateLessons(db, SAMPLE);
    const md = renderReport({
      startedAt: new Date("2026-09-28T00:00:00Z"),
      dryRun: true,
      target: "localhost",
      users: usersReport,
      lessons: report,
      media: { copied: 0, existing: 0, failed: [], skipped: true },
    });
    expect(md).toContain("| students → users | 5 | 2 | 0 | 3 |");
    expect(md).toContain("| lessons | 3 | 3 | 0 |");
    expect(md).toContain("dry run");
    expect(md).not.toMatch(/Nguyễn|0900/);
  });
});
