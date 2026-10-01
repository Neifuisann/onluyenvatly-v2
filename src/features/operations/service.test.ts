import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import {
  attempts,
  lessons,
  lessonVersions,
  rateLimits,
  ratings,
  sessions,
  users,
} from "@/db/schema";
import { DEFAULT_LESSON_CONFIG } from "@/features/lessons/schema";
import { resetDb, type TestDb } from "@/test/db";
import { runDailyMaintenance } from "./service";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));
vi.mock("@/features/ai/import-service", () => ({
  cleanupImports: async () => 3,
}));
const tdb = db as unknown as TestDb;
const now = new Date("2026-10-01T20:00:00Z");
const old = new Date(now.getTime() - 181 * 86_400_000);
beforeEach(async () => resetDb(tdb));

it("grades saved answers once, prunes expired data and protects current/draft/item versions", async () => {
  const [user] = await tdb
    .insert(users)
    .values({
      username: "cron_student",
      fullName: "Synthetic",
      passwordHash: "unused",
    })
    .returning();
  const [lesson] = await tdb
    .insert(lessons)
    .values({ title: "Synthetic", config: DEFAULT_LESSON_CONFIG })
    .returning();
  if (!user || !lesson) throw new Error("seed");
  const questions = [
    {
      id: "q_1",
      type: "mcq",
      stem: "Synthetic",
      options: [{ text: "a" }, { text: "b" }],
      answer: 0,
      points: 1,
    },
  ];
  const versions = await tdb
    .insert(lessonVersions)
    .values(
      [1, 2, 3, 4].map((version) => ({
        lessonId: lesson.id,
        version,
        sourceText: "",
        questions,
        createdAt: old,
      })),
    )
    .returning();
  const current = versions[0];
  const unused = versions[1];
  const draft = versions[2];
  const itemVersion = versions[3];
  if (!current || !unused || !draft || !itemVersion) throw new Error("seed");
  await tdb
    .update(lessons)
    .set({ currentVersionId: current.id, draftVersionId: draft.id })
    .where(eq(lessons.id, lesson.id));
  const [attempt] = await tdb
    .insert(attempts)
    .values({
      userId: user.id,
      lessonId: lesson.id,
      lessonVersionId: current.id,
      items: [{ q: "q_1", v: itemVersion.id, p: 1 }],
      answers: ["A"],
      maxScore: 1,
      startedAt: old,
      deadlineAt: new Date(now.getTime() - 3_600_001),
      ip: "203.0.113.1",
      guardEvents: [{ k: "blur", t: 1 }],
    })
    .returning();
  await tdb.insert(sessions).values([
    { id: "expired", userId: user.id, expiresAt: new Date(now.getTime() - 1) },
    { id: "active", userId: user.id, expiresAt: now },
  ]);
  await tdb.insert(rateLimits).values([
    { key: "old", count: 1, windowStart: old },
    { key: "current", count: 1, windowStart: now },
  ]);
  const result = await runDailyMaintenance(now);
  expect(result).toMatchObject({
    submitted: 1,
    failed: 0,
    pending: 0,
    sessions: 1,
    rateLimits: 1,
    versions: 1,
    privateRows: 1,
    imports: 3,
  });
  const [saved] = await tdb
    .select()
    .from(attempts)
    .where(eq(attempts.id, attempt?.id ?? ""));
  expect(saved).toMatchObject({
    status: "submitted",
    answers: ["A"],
    earned: [1],
    score: 1,
    score10: 10,
    ip: null,
    guardEvents: [],
  });
  expect((await tdb.select().from(lessonVersions)).map((v) => v.id)).toEqual([
    current.id,
    draft.id,
    itemVersion.id,
  ]);
  const before = await tdb.select().from(ratings);
  expect(await runDailyMaintenance(now)).toMatchObject({
    submitted: 0,
    failed: 0,
    pending: 0,
    versions: 0,
  });
  expect(await tdb.select().from(ratings)).toEqual(before);
});

it("leaves unlimited and recently expired attempts open", async () => {
  const [user] = await tdb
    .insert(users)
    .values({
      username: "cron_student",
      fullName: "Synthetic",
      passwordHash: "unused",
    })
    .returning();
  if (!user) throw new Error("seed");
  await tdb.insert(attempts).values({
    userId: user.id,
    items: [],
    answers: [],
    maxScore: 1,
    deadlineAt: null,
  });
  const [other] = await tdb
    .insert(users)
    .values({
      username: "cron_recent",
      fullName: "Synthetic",
      passwordHash: "unused",
    })
    .returning();
  if (!other) throw new Error("seed");
  await tdb.insert(attempts).values({
    userId: other.id,
    items: [],
    answers: [],
    maxScore: 1,
    deadlineAt: new Date(now.getTime() - 3_600_000),
  });
  expect(await runDailyMaintenance(now)).toMatchObject({
    submitted: 0,
    pending: 0,
  });
  expect((await tdb.select().from(attempts)).map((a) => a.status)).toEqual([
    "in_progress",
    "in_progress",
  ]);
});
