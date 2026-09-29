import type {
  GenerateContentParameters,
  GenerateContentResponse,
} from "@google/genai";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import {
  auditLog,
  explanationVotes,
  lessons,
  lessonVersions,
  questionExplanations,
  users,
} from "@/db/schema";
import {
  DEFAULT_LESSON_CONFIG,
  type Question,
} from "@/features/lessons/schema";
import { resetDb, type TestDb } from "@/test/db";
import {
  getExplanationLessons,
  getFlaggedExplanations,
  getLessonExplanations,
} from "./admin-queries";
import {
  approveExplanation,
  pregenerateStep,
  regenerateExplanation,
  updateExplanation,
} from "./admin-service";
import { questionHash } from "./domain/explain";
import { type AiGate, createAi, type GeminiModels } from "./gemini";
import { adminExplanationsCopy } from "./messages";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

const tdb = db as unknown as TestDb;
const NOW = new Date("2026-10-20T02:00:00Z");

const mcq = (id: string, stem: string): Question => ({
  id,
  type: "mcq",
  stem,
  options: [{ text: "a" }, { text: "b" }],
  answer: 0,
});
const questions: Question[] = [
  mcq("q_1", "Một"),
  { ...mcq("q_2", "Hai"), explanation: "Giáo viên viết." },
  mcq("q_3", "Ba"),
  mcq("q_4", "Một"),
];
const [h1, , h3] = questions.map((q) => questionHash(q));

/** Answers each call with the next reply (`null` = truncated). */
function fakeAi(replies: (string | null)[], gate?: AiGate) {
  let i = 0;
  const client = {
    generateContent: vi.fn(async (_p: GenerateContentParameters) => {
      const reply =
        i < replies.length ? (replies[i] as string | null) : "Giải thích";
      i++;
      return {
        text: reply ?? "Nửa câu",
        candidates: [{ finishReason: reply === null ? "MAX_TOKENS" : "STOP" }],
        usageMetadata: { promptTokenCount: 600, candidatesTokenCount: 300 },
      } as unknown as GenerateContentResponse;
    }),
    generateContentStream: vi.fn(),
  };
  const ai = createAi({
    client: () => client as unknown as GeminiModels,
    models: { text: ["gemini-test"], import: [] },
    gate: gate ?? (async () => ({ ok: true })),
    log: () => {},
  });
  return { ai, client };
}

let admin: { id: string };
let student: { id: string };
let lessonId: number;

async function addUser(role: "admin" | "student", phone: string) {
  const [u] = await tdb
    .insert(users)
    .values({
      role,
      status: "active",
      fullName: "Người Dùng",
      phone,
      passwordHash: "x",
    })
    .returning({ id: users.id });
  return { id: u?.id ?? "" };
}

async function addLesson(qs: Question[], title = "Dao động") {
  const [lesson] = await tdb
    .insert(lessons)
    .values({ title, status: "published", config: DEFAULT_LESSON_CONFIG })
    .returning({ id: lessons.id });
  const id = lesson?.id ?? 0;
  const [version] = await tdb
    .insert(lessonVersions)
    .values({ lessonId: id, version: 1, sourceText: "", questions: qs })
    .returning({ id: lessonVersions.id });
  await tdb
    .update(lessons)
    .set({ currentVersionId: version?.id ?? null })
    .where(eq(lessons.id, id));
  return id;
}

const storedRows = () =>
  tdb
    .select({
      hash: questionExplanations.questionHash,
      questionId: questionExplanations.questionId,
      contentMd: questionExplanations.contentMd,
      source: questionExplanations.source,
    })
    .from(questionExplanations);

const actions = async () =>
  (await tdb.select({ action: auditLog.action }).from(auditLog)).map(
    (r) => r.action,
  );

beforeEach(async () => {
  await resetDb(tdb);
  admin = await addUser("admin", "0900000001");
  student = await addUser("student", "0900000002");
  lessonId = await addLesson(questions);
});

describe("pregenerateStep", () => {
  it("generates the missing questions one per step, in order, sharing duplicates", async () => {
    const { ai, client } = fakeAi(["## Một\nlời giải", "Ba: lời giải"]);
    const step = (skip: string[] = []) =>
      pregenerateStep(admin, { lessonId, skip }, { ai });

    expect(await step()).toEqual({
      ok: true,
      data: { questionId: "q_1", generated: true, remaining: 1 },
    });
    expect(await step()).toEqual({
      ok: true,
      data: { questionId: "q_3", generated: true, remaining: 0 },
    });
    expect(await step()).toEqual({
      ok: true,
      data: { questionId: null, generated: false, remaining: 0 },
    });
    expect(client.generateContent).toHaveBeenCalledTimes(2);
    expect(await storedRows()).toEqual(
      expect.arrayContaining([
        {
          hash: h1,
          questionId: "q_1",
          contentMd: "**Một**\nlời giải",
          source: "ai",
        },
        {
          hash: h3,
          questionId: "q_3",
          contentMd: "Ba: lời giải",
          source: "ai",
        },
      ]),
    );
    expect(await actions()).toEqual([
      "explanation.pregenerate",
      "explanation.pregenerate",
    ]);
    const view = await getLessonExplanations(lessonId);
    expect(view?.counts).toEqual({
      total: 4,
      teacher: 1,
      stored: 3,
      missing: 0,
    });
  });

  it("reports an incomplete answer so the caller can skip it", async () => {
    const { ai } = fakeAi([null, "Ba"]);
    expect(
      await pregenerateStep(admin, { lessonId, skip: [] }, { ai }),
    ).toEqual({
      ok: true,
      data: { questionId: "q_1", generated: false, remaining: 1 },
    });
    expect(
      await pregenerateStep(admin, { lessonId, skip: ["q_1"] }, { ai }),
    ).toEqual({
      ok: true,
      data: { questionId: "q_3", generated: true, remaining: 0 },
    });
    expect((await storedRows()).map((r) => r.questionId)).toEqual(["q_3"]);
  });

  it("stops with the budget's message", async () => {
    const { ai } = fakeAi([], async () => ({
      ok: false,
      code: "AI_QUOTA",
      reason: "budget",
    }));
    expect(
      await pregenerateStep(admin, { lessonId, skip: [] }, { ai }),
    ).toMatchObject({
      ok: false,
      code: "AI_QUOTA",
      message: adminExplanationsCopy.quota,
    });
    expect(await storedRows()).toEqual([]);
  });

  it("refuses a lesson without published content", async () => {
    const [draft] = await tdb
      .insert(lessons)
      .values({ title: "Nháp", config: DEFAULT_LESSON_CONFIG })
      .returning({ id: lessons.id });
    const { ai } = fakeAi([]);
    expect(
      await pregenerateStep(
        admin,
        { lessonId: draft?.id ?? 0, skip: [] },
        { ai },
      ),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await getLessonExplanations(draft?.id ?? 0)).toBeNull();
    expect((await getExplanationLessons()).map((l) => l.id)).toEqual([
      lessonId,
    ]);
  });
});

describe("review actions", () => {
  async function seed(votesDown = 0) {
    await tdb.insert(questionExplanations).values({
      questionHash: h1 as string,
      lessonId,
      questionId: "q_1",
      contentMd: "Cũ",
      model: "gemini-old",
      votesUp: 1,
      votesDown,
    });
    await tdb
      .insert(explanationVotes)
      .values({ questionHash: h1 as string, userId: student.id, up: false });
  }

  it("lists unreviewed explanations with 3+ down votes, most first", async () => {
    await seed(3);
    await tdb.insert(questionExplanations).values([
      {
        questionHash: h3 as string,
        lessonId,
        questionId: "q_3",
        contentMd: "x",
        votesDown: 5,
      },
      {
        questionHash: "f".repeat(64),
        lessonId: null,
        questionId: "q_9",
        contentMd: "y",
        votesDown: 2,
      },
    ]);
    const flagged = await getFlaggedExplanations();
    expect(
      flagged.map((f) => [f.questionId, f.votesDown, f.lessonTitle]),
    ).toEqual([
      ["q_3", 5, "Dao động"],
      ["q_1", 3, "Dao động"],
    ]);
    await approveExplanation(admin, { hash: h1 as string }, NOW);
    expect((await getFlaggedExplanations()).map((f) => f.questionId)).toEqual([
      "q_3",
    ]);
  });

  it("saves the teacher's edit as reviewed teacher text, keeping votes", async () => {
    await seed(4);
    expect(
      await updateExplanation(
        admin,
        { hash: h1 as string, contentMd: "Giáo viên sửa $T$" },
        NOW,
      ),
    ).toEqual({ ok: true, data: { hash: h1 } });
    const [row] = await tdb
      .select()
      .from(questionExplanations)
      .where(eq(questionExplanations.questionHash, h1 as string));
    expect(row).toMatchObject({
      contentMd: "Giáo viên sửa $T$",
      source: "teacher",
      reviewedAt: NOW,
      reviewedBy: admin.id,
      votesDown: 4,
    });
    expect(await actions()).toEqual(["explanation.update"]);
    expect(
      await updateExplanation(admin, { hash: "a".repeat(64), contentMd: "x" }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(
      await approveExplanation(admin, { hash: "a".repeat(64) }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("regenerates from the published question, clearing votes and review", async () => {
    await seed(3);
    await approveExplanation(admin, { hash: h1 as string }, NOW);
    const { ai, client } = fakeAi(["Mới"]);
    expect(
      await regenerateExplanation(
        admin,
        { hash: h1 as string },
        { ai, now: NOW },
      ),
    ).toEqual({ ok: true, data: { hash: h1 } });
    const prompt = client.generateContent.mock.calls[0]?.[0];
    expect(prompt?.contents).toContain("Đề bài: Một");
    const [row] = await tdb
      .select()
      .from(questionExplanations)
      .where(eq(questionExplanations.questionHash, h1 as string));
    expect(row).toMatchObject({
      contentMd: "Mới",
      source: "ai",
      model: "gemini-test",
      votesUp: 0,
      votesDown: 0,
      reviewedAt: null,
    });
    expect(await tdb.select().from(explanationVotes)).toEqual([]);
    expect(await actions()).toEqual([
      "explanation.approve",
      "explanation.regenerate",
    ]);
  });

  it("cannot regenerate once the question has changed", async () => {
    await seed();
    await tdb
      .update(lessonVersions)
      .set({ questions: [mcq("q_1", "Một đã sửa")] })
      .where(eq(lessonVersions.lessonId, lessonId));
    const { ai, client } = fakeAi(["Mới"]);
    expect(
      await regenerateExplanation(admin, { hash: h1 as string }, { ai }),
    ).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
      message: adminExplanationsCopy.questionChanged,
    });
    expect(client.generateContent).not.toHaveBeenCalled();
  });

  it("keeps the old text when the new answer is incomplete", async () => {
    await seed();
    const { ai } = fakeAi([null]);
    expect(
      await regenerateExplanation(admin, { hash: h1 as string }, { ai }),
    ).toMatchObject({ ok: false, code: "AI_UNAVAILABLE" });
    expect((await storedRows())[0]?.contentMd).toBe("Cũ");
  });
});
