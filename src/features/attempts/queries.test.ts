import { beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { attempts, ratingEvents, users } from "@/db/schema";
import { resetDb, type TestDb } from "@/test/db";
import { getAttempt, getAttemptForResult } from "./queries";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
beforeEach(() => resetDb(db as unknown as TestDb));

it("keeps the ownership/content projection and joins one optional rating", async () => {
  const [user] = await db
    .insert(users)
    .values({
      fullName: "Synthetic query test",
      username: "query_test",
      passwordHash: "test-only",
      status: "active",
    })
    .returning();
  if (!user) throw new Error("Missing test user");
  const [attempt] = await db
    .insert(attempts)
    .values({
      userId: user.id,
      mode: "review",
      status: "submitted",
      items: [],
      answers: [],
      earned: [],
      maxScore: 0,
      score: 0,
      score10: 0,
    })
    .returning();
  if (!attempt) throw new Error("Missing test attempt");
  const original = await getAttempt(attempt.id);
  expect(await getAttemptForResult(attempt.id)).toEqual({
    attempt: original,
    rating: null,
  });
  await db.insert(ratingEvents).values({
    userId: user.id,
    attemptId: attempt.id,
    formula: "v2",
    before: 1500,
    delta: 10,
    after: 1510,
  });
  expect(await getAttemptForResult(attempt.id)).toEqual({
    attempt: original,
    rating: { before: 1500, delta: 10, after: 1510 },
  });
  expect(
    await getAttemptForResult("00000000-0000-4000-8000-000000000000"),
  ).toBeNull();
});
