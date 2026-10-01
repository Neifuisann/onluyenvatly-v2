import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { attempts, lessons, users } from "@/db/schema";
import { DEFAULT_LESSON_CONFIG } from "@/features/lessons/schema";
import { resetDb, type TestDb } from "@/test/db";
import { flushAttemptCounters, recordAttemptCount } from "./counter-service";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
const tdb = db as unknown as TestDb;
beforeEach(async () => resetDb(tdb));
it("repairs pending counters once and ignores open/review attempts", async () => {
  const [user] = await tdb
    .insert(users)
    .values({
      username: "counter_student",
      fullName: "Synthetic",
      passwordHash: "unused",
    })
    .returning();
  const [lesson] = await tdb
    .insert(lessons)
    .values({ title: "Synthetic", config: DEFAULT_LESSON_CONFIG })
    .returning();
  if (!user || !lesson) throw new Error("seed");
  const rows = await tdb
    .insert(attempts)
    .values([
      {
        userId: user.id,
        lessonId: lesson.id,
        status: "submitted",
        items: [],
        answers: [],
        earned: [],
        score: 0,
        score10: 0,
        maxScore: 1,
      },
      {
        userId: user.id,
        lessonId: lesson.id,
        items: [],
        answers: [],
        maxScore: 1,
      },
      {
        userId: user.id,
        lessonId: null,
        mode: "review",
        status: "submitted",
        items: [],
        answers: [],
        earned: [],
        score: 0,
        score10: 0,
        maxScore: 1,
      },
    ])
    .returning();
  expect(await flushAttemptCounters()).toBe(1);
  expect(await flushAttemptCounters()).toBe(0);
  const id = rows[0]?.id;
  if (!id) throw new Error("seed");
  await Promise.all([recordAttemptCount(id), recordAttemptCount(id)]);
  expect(
    (await tdb.select().from(lessons).where(eq(lessons.id, lesson.id)))[0]
      ?.attemptCount,
  ).toBe(1);
  expect(
    (await tdb.select().from(attempts).where(eq(attempts.id, id)))[0]
      ?.counterRecorded,
  ).toBe(true);
});
