import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { lessons, lessonVersions } from "@/db/schema";
import type { TestDb } from "@/test/db";
import { getSharePreview } from "./queries";
import type { Question } from "./schema";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

const tdb = db as unknown as TestDb;

const questions: Question[] = [
  {
    id: "q1",
    type: "mcq",
    stem: "Chu kì $T$ đo bằng?",
    options: [{ text: "s" }, { text: "m" }, { text: "Hz" }],
    answer: 2,
    explanation: "SECRET_EXPLANATION",
  },
  {
    id: "q2",
    type: "tf",
    stem: "Con lắc đơn",
    statements: [
      { text: "a", answer: true },
      { text: "b", answer: false },
    ],
  },
  { id: "q3", type: "short", stem: "g = ?", answer: "9,8" },
];

async function addLesson(
  status: "published" | "draft",
  config: Record<string, unknown> = {},
) {
  const [row] = await tdb
    .insert(lessons)
    .values({ title: `Bài ${status}`, status, grade: 12, config })
    .returning({ id: lessons.id });
  const id = row?.id ?? 0;
  const [v] = await tdb
    .insert(lessonVersions)
    .values({ lessonId: id, version: 1, sourceText: "…", questions })
    .returning({ id: lessonVersions.id });
  await tdb
    .update(lessons)
    .set({ currentVersionId: v?.id ?? null })
    .where(eq(lessons.id, id));
  return id;
}

describe("getSharePreview (S8-03)", () => {
  it("gives a published lesson's details and its first two questions, answer-free", async () => {
    const id = await addLesson("published", { timeLimitSec: 900 });
    const preview = await getSharePreview(id);
    expect(preview).toMatchObject({
      id,
      title: "Bài published",
      grade: 12,
      timeLimitSec: 900,
      examGuard: false,
      startsAt: null,
    });
    expect(preview?.questions).toEqual([
      {
        id: "q1",
        type: "mcq",
        stem: "Chu kì $T$ đo bằng?",
        options: [{ text: "s" }, { text: "m" }, { text: "Hz" }],
      },
      {
        id: "q2",
        type: "tf",
        stem: "Con lắc đơn",
        statements: [{ text: "a" }, { text: "b" }],
      },
    ]);
    const json = JSON.stringify(preview);
    expect(json).not.toMatch(/answer|explanation|SECRET|9,8/i);
  });

  it("shows no question of an exam or a scheduled test", async () => {
    for (const config of [
      { examGuard: true },
      { startsAt: "2026-10-01T07:00:00+07:00" },
    ]) {
      const preview = await getSharePreview(
        await addLesson("published", config),
      );
      expect(preview?.title).toBe("Bài published");
      expect(preview?.questions).toEqual([]);
    }
  });

  it("is null for drafts and unknown ids", async () => {
    expect(await getSharePreview(await addLesson("draft"))).toBeNull();
    expect(await getSharePreview(987654)).toBeNull();
  });
});
