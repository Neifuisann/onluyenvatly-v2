import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import {
  attempts,
  gameRooms,
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

it("closes abandoned game rooms, drops month-old ones and keeps their versions (B-05)", async () => {
  const [host] = await tdb
    .insert(users)
    .values({
      role: "admin",
      username: "cron_host",
      fullName: "Synthetic",
      passwordHash: "unused",
    })
    .returning();
  const [lesson] = await tdb
    .insert(lessons)
    .values({ title: "Synthetic", config: DEFAULT_LESSON_CONFIG })
    .returning();
  if (!host || !lesson) throw new Error("seed");
  const [bankVersion, current] = await tdb
    .insert(lessonVersions)
    .values(
      [1, 2].map((version) => ({
        lessonId: lesson.id,
        version,
        sourceText: "",
        questions: [],
        createdAt: old,
      })),
    )
    .returning();
  if (!bankVersion || !current) throw new Error("seed");
  await tdb
    .update(lessons)
    .set({ currentVersionId: current.id })
    .where(eq(lessons.id, lesson.id));
  const day = 86_400_000;
  const room = (
    pin: string,
    patch: Partial<typeof gameRooms.$inferInsert>,
  ) => ({
    pin,
    hostId: host.id,
    title: pin,
    pace: "normal",
    bank: [{ l: lesson.id, v: bankVersion.id, q: "q_1" }],
    bankTypes: ["mcq" as const],
    lessonIds: [lesson.id],
    ...patch,
  });
  await tdb.insert(gameRooms).values([
    // Abandoned lobby and a race past its hard end: closed.
    room("111111", { createdAt: new Date(now.getTime() - 2 * day) }),
    room("222222", {
      status: "running",
      createdAt: new Date(now.getTime() - 2 * day),
      hardEndAt: new Date(now.getTime() - 1),
    }),
    // A lobby opened an hour ago and a live race: untouched.
    room("333333", { createdAt: new Date(now.getTime() - 3_600_000) }),
    room("444444", {
      status: "running",
      createdAt: new Date(now.getTime() - 3_600_000),
      hardEndAt: new Date(now.getTime() + 60_000),
    }),
    // A month old: deleted.
    room("555555", {
      status: "finished",
      createdAt: new Date(now.getTime() - 31 * day),
    }),
  ]);
  expect(await runDailyMaintenance(now)).toMatchObject({
    closedRooms: 2,
    oldRooms: 1,
    versions: 0,
  });
  const rooms = await tdb
    .select({ pin: gameRooms.pin, status: gameRooms.status })
    .from(gameRooms)
    .orderBy(gameRooms.pin);
  expect(rooms).toEqual([
    { pin: "111111", status: "finished" },
    { pin: "222222", status: "finished" },
    { pin: "333333", status: "lobby" },
    { pin: "444444", status: "running" },
  ]);
  // The bank's version is not current, yet it stays while a room uses it.
  expect((await tdb.select().from(lessonVersions)).map((v) => v.id)).toEqual([
    bankVersion.id,
    current.id,
  ]);
});
