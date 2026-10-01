import { eq } from "drizzle-orm";
import { beforeEach, expect, it } from "vitest";
import {
  attempts,
  lessonVersions,
  mistakes,
  ratingEvents,
  ratings,
  users,
} from "@/db/schema";
import { createTestDb, resetDb, type TestDb } from "@/test/db";
import { migrateHistory } from "./migrate-history";
import { migrateLessons, migrateUsers } from "./migrate-legacy";

let db: TestDb;
const submitted = "2026-09-01T00:00:00Z";
const student = {
  id: "legacy_student",
  full_name: "Synthetic",
  phone_number: "0900000001",
  password_hash: `$2b$10$${"a".repeat(53)}`,
  is_approved: true,
};
const lesson = {
  id: "legacy_lesson",
  title: "Synthetic",
  questions: [
    {
      id: "q_1",
      type: "abcd",
      question: "Synthetic?",
      options: ["one", "two"],
      correct: "A",
    },
  ],
};
const result = {
  id: "legacy_result",
  student_id: student.id,
  lesson_id: lesson.id,
  timestamp: submitted,
  time_taken: 90,
  score: 0,
  total_points: 1,
  questions: [
    {
      type: "abcd",
      question: "Historic?",
      optionsText: ["two", "one"],
      correctAnswer: "one",
      userAnswer: "two",
      earnedPoints: 0,
      points: 1,
    },
  ],
};
const history = {
  id: 1,
  student_id: student.id,
  lesson_id: lesson.id,
  timestamp: submitted,
  previous_rating: 1500,
  rating_change: -20,
  new_rating: 1480,
  performance: 0,
};
const snapshot = {
  student_id: student.id,
  rating: 1480,
  last_updated: submitted,
};
beforeEach(async () => {
  db ??= await createTestDb();
  await resetDb(db);
  await migrateUsers(db, [student]);
  await migrateLessons(db, [lesson]);
});
it("imports immutable snapshots, events and mistakes idempotently", async () => {
  const first = await migrateHistory(db, [[result]], [history], [snapshot]);
  expect(first).toMatchObject({
    inserted: 1,
    versions: 1,
    events: 1,
    unmatchedEvents: 0,
    ratings: 1,
    mistakes: 1,
  });
  const [a] = await db.select().from(attempts);
  expect(a).toMatchObject({
    answers: ["A"],
    earned: [0],
    score10: 0,
    timeTakenSec: 90,
    items: [{ o: [1, 0], p: 1 }],
  });
  expect((await db.select().from(ratingEvents))[0]?.attemptId).toBe(a?.id);
  const before = await db.select().from(mistakes);
  const rerun = await migrateHistory(db, [[result]], [history], [snapshot]);
  expect(rerun).toMatchObject({
    inserted: 0,
    existing: 1,
    versions: 0,
    events: 0,
    eventsExisting: 1,
  });
  expect(await db.select().from(mistakes)).toEqual(before);
  expect(await db.$count(lessonVersions)).toBe(2);
  await migrateLessons(db, [lesson]);
  expect(await db.$count(lessonVersions)).toBe(2);
});
it("preserves native pilot attempts and rebases their rating on the copied v1 snapshot", async () => {
  await migrateHistory(db, [[result]], [history], [snapshot]);
  const [user] = await db.select().from(users);
  const [version] = await db
    .select()
    .from(lessonVersions)
    .where(eq(lessonVersions.version, 1));
  if (!user || !version) throw new Error("seed");
  const [native] = await db
    .insert(attempts)
    .values({
      userId: user.id,
      lessonId: version.lessonId,
      lessonVersionId: version.id,
      status: "submitted",
      counterRecorded: true,
      items: [{ q: "q_1", p: 1 }],
      answers: ["A"],
      earned: [1],
      score: 1,
      maxScore: 1,
      score10: 10,
      submittedAt: new Date("2026-09-02T00:00:00Z"),
    })
    .returning();
  await db.insert(ratingEvents).values({
    userId: user.id,
    attemptId: native?.id ?? null,
    lessonId: version.lessonId,
    before: 1480,
    delta: 50,
    after: 1530,
    formula: "v2",
    performance: 1,
    timeBonus: 1,
    createdAt: new Date("2026-09-02T00:00:00Z"),
  });
  const report = await migrateHistory(db, [[result]], [history], [snapshot]);
  expect(report.nativeRatingsRebased).toBe(1);
  expect(await db.$count(attempts)).toBe(2);
  expect(await db.$count(ratingEvents)).toBe(2);
  expect((await db.select().from(ratings))[0]?.rating).toBeGreaterThan(1480);
  expect(
    await db
      .select()
      .from(attempts)
      .where(eq(attempts.id, native?.id ?? "")),
  ).toEqual([native]);
});
it("documents missing source data and leaves ambiguous rating links empty", async () => {
  const duplicate = { ...result, id: "legacy_result_2" };
  const report = await migrateHistory(
    db,
    [
      [
        result,
        duplicate,
        { ...result, id: "orphan", student_id: null },
        {
          ...result,
          id: "sparse",
          questions: [{ type: "ABCD", questionId: "q_1" }],
        },
      ],
    ],
    [history],
    [snapshot],
  );
  expect(report).toMatchObject({
    inserted: 2,
    unmatchedEvents: 1,
    skipped: { "student not migrated": 1, "invalid embedded question": 1 },
  });
  expect((await db.select().from(ratingEvents))[0]?.attemptId).toBeNull();
});
it("keeps referenced version content when the v1 lesson changes", async () => {
  const before = await db.select().from(lessonVersions);
  await migrateLessons(db, [
    {
      ...lesson,
      questions: [{ ...lesson.questions[0], question: "New content" }],
    },
  ]);
  expect(await db.$count(lessonVersions)).toBe(2);
  expect(
    (await db.select().from(lessonVersions)).find(
      (v) => v.id === before[0]?.id,
    ),
  ).toEqual(before[0]);
});
