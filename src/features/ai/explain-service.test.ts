import { randomUUID } from "node:crypto";
import type {
  GenerateContentParameters,
  GenerateContentResponse,
} from "@google/genai";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import {
  attempts,
  lessons,
  lessonVersions,
  questionExplanations,
  users,
} from "@/db/schema";
import { startAttempt, submitAttempt } from "@/features/attempts/service";
import type { SessionUser } from "@/features/auth/session";
import {
  DEFAULT_LESSON_CONFIG,
  type LessonConfig,
  type Question,
} from "@/features/lessons/schema";
import { startReviewPractice } from "@/features/review/practice-service";
import { resetDb, type TestDb } from "@/test/db";
import { PROMPT_VERSION, questionHash } from "./domain/explain";
import {
  EXPLAIN_PER_USER_DAY,
  type ExplainOutcome,
  explainQuestion,
  voteExplanation,
} from "./explain-service";
import { type AiGate, createAi, type GeminiModels } from "./gemini";
import { explainCopy } from "./messages";
import { getReviewExplanations } from "./queries";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

const tdb = db as unknown as TestDb;
const NOW = new Date("2026-10-20T02:00:00Z");

const questions: Question[] = [
  {
    id: "q_mcq",
    type: "mcq",
    stem: "Đơn vị của chu kì?",
    options: [{ text: "s" }, { text: "m" }],
    answer: 0,
  },
  {
    id: "q_teacher",
    type: "short",
    stem: "T = ?",
    answer: "2",
    explanation: "Giáo viên: T = 2 s.",
  },
];

const chunk = (text: string, finishReason?: string) =>
  ({
    text,
    candidates: [{ finishReason: finishReason ?? "STOP" }],
    usageMetadata: { promptTokenCount: 600, candidatesTokenCount: 450 },
  }) as unknown as GenerateContentResponse;

function fakeAi(
  parts: string[] = ["## Ý chính\n", "Chu kì đo bằng giây ($s$)."],
  opts: { finishReason?: string; gate?: AiGate } = {},
) {
  const client = {
    generateContent: vi.fn(),
    generateContentStream: vi.fn(async (_p: GenerateContentParameters) =>
      (async function* () {
        for (const [i, p] of parts.entries())
          yield chunk(p, i === parts.length - 1 ? opts.finishReason : "STOP");
      })(),
    ),
  } satisfies GeminiModels;
  const ai = createAi({
    client: () => client as unknown as GeminiModels,
    models: { text: ["gemini-test"], import: [] },
    gate: opts.gate ?? (async () => ({ ok: true })),
    log: () => {},
  });
  return { ai, client };
}

let phoneSeq = 0;
async function addUser(role: "student" | "admin" = "student") {
  const [u] = await tdb
    .insert(users)
    .values({
      role,
      status: "active",
      fullName: "Học Sinh",
      phone: `09${String(++phoneSeq).padStart(8, "0")}`,
      passwordHash: "x",
    })
    .returning({ id: users.id });
  const id = u?.id ?? "";
  return {
    id,
    role,
    fullName: "Học Sinh",
    grade: 12,
    mustChangePassword: false,
    sessionId: "s",
  } satisfies SessionUser;
}

async function addLesson(config: Partial<LessonConfig> = {}) {
  const [lesson] = await tdb
    .insert(lessons)
    .values({
      title: "Dao động",
      status: "published",
      config: { ...DEFAULT_LESSON_CONFIG, shuffleQuestions: false, ...config },
    })
    .returning({ id: lessons.id });
  const id = lesson?.id ?? 0;
  const [version] = await tdb
    .insert(lessonVersions)
    .values({ lessonId: id, version: 1, sourceText: "", questions })
    .returning({ id: lessonVersions.id });
  await tdb
    .update(lessons)
    .set({ currentVersionId: version?.id ?? null })
    .where(eq(lessons.id, id));
  return id;
}

/** A submitted attempt, and the index of each question in it. */
async function take(user: SessionUser, lessonId: number, submit = true) {
  const started = await startAttempt(user, lessonId, {
    ip: null,
    now: NOW,
    seed: 1,
  });
  if (!started.ok) throw new Error(started.code);
  const id = started.data.attemptId;
  if (submit) {
    const done = await submitAttempt(
      user.id,
      id,
      {
        answers: [null, null],
        flagged: [],
        guardEvents: [],
        clientSubmitId: randomUUID(),
      },
      new Date(NOW.getTime() + 60_000),
    );
    if (!done.ok) throw new Error(done.code);
  }
  const [row] = await tdb
    .select({ items: attempts.items })
    .from(attempts)
    .where(eq(attempts.id, id));
  const index = (q: string) => row?.items.findIndex((i) => i.q === q) ?? -1;
  return { id, mcq: index("q_mcq"), teacher: index("q_teacher") };
}

async function drain(outcome: ExplainOutcome) {
  if (outcome.kind === "cached") return { text: outcome.contentMd, done: null };
  let text = "";
  for await (const c of outcome.chunks) text += c;
  return { text, done: await outcome.done };
}

const stored = () =>
  tdb
    .select({
      hash: questionExplanations.questionHash,
      lessonId: questionExplanations.lessonId,
      questionId: questionExplanations.questionId,
      source: questionExplanations.source,
      model: questionExplanations.model,
      promptVersion: questionExplanations.promptVersion,
      contentMd: questionExplanations.contentMd,
    })
    .from(questionExplanations);

const mcqHash = questionHash(questions[0] as Question);

beforeEach(async () => {
  await resetDb(tdb);
});

describe("explainQuestion", () => {
  it("generates once, stores the cleaned text, then serves it from the cache", async () => {
    const lessonId = await addLesson();
    const [a, b] = [await addUser(), await addUser()];
    const ta = await take(a, lessonId);
    const tb = await take(b, lessonId);
    const { ai, client } = fakeAi();

    const first = await explainQuestion(
      a,
      { attemptId: ta.id, index: ta.mcq },
      { ai, now: NOW },
    );
    if (!first.ok) throw new Error(first.code);
    expect(first.data.kind).toBe("stream");
    expect(await drain(first.data)).toEqual({
      text: "## Ý chính\nChu kì đo bằng giây ($s$).",
      done: { ok: true, stored: true },
    });
    expect(await stored()).toEqual([
      {
        hash: mcqHash,
        lessonId,
        questionId: "q_mcq",
        source: "ai",
        model: "gemini-test",
        promptVersion: PROMPT_VERSION,
        contentMd: "**Ý chính**\nChu kì đo bằng giây ($s$).",
      },
    ]);

    // Another student, same question: no Gemini call.
    const second = await explainQuestion(
      b,
      { attemptId: tb.id, index: tb.mcq },
      { ai, now: NOW },
    );
    expect(second).toEqual({
      ok: true,
      data: {
        kind: "cached",
        contentMd: "**Ý chính**\nChu kì đo bằng giây ($s$).",
      },
    });
    expect(client.generateContentStream).toHaveBeenCalledTimes(1);
    const prompt = vi.mocked(client.generateContentStream).mock.calls[0]?.[0];
    expect(prompt?.contents).toContain("Đáp án đúng: A. s");
  });

  it("reuses the explanation for the same question in another lesson", async () => {
    const [l1, l2] = [await addLesson(), await addLesson()];
    const user = await addUser();
    const { ai, client } = fakeAi();
    const t1 = await take(user, l1);
    await drain(
      (
        (await explainQuestion(
          user,
          { attemptId: t1.id, index: t1.mcq },
          { ai, now: NOW },
        )) as { ok: true; data: ExplainOutcome }
      ).data,
    );
    const t2 = await take(user, l2);
    const again = await explainQuestion(
      user,
      { attemptId: t2.id, index: t2.mcq },
      { ai, now: NOW },
    );
    expect(again.ok && again.data.kind).toBe("cached");
    expect(client.generateContentStream).toHaveBeenCalledTimes(1);
  });

  it("explains a question of a submitted review attempt (S7-06)", async () => {
    const lessonId = await addLesson();
    const user = await addUser();
    await take(user, lessonId);
    const started = await startReviewPractice(
      user,
      { chapter: null, type: null, count: 10 },
      { now: NOW, seed: 1 },
    );
    if (!started.ok) throw new Error(started.code);
    const [row] = await tdb
      .select({ items: attempts.items, lessonId: attempts.lessonId })
      .from(attempts)
      .where(eq(attempts.id, started.data.attemptId));
    expect(row?.lessonId).toBeNull();
    const index = row?.items.findIndex((i) => i.q === "q_mcq") ?? -1;
    const { ai } = fakeAi();
    // Not before it is submitted…
    expect(
      await explainQuestion(
        user,
        { attemptId: started.data.attemptId, index },
        { ai, now: NOW },
      ),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
    const done = await submitAttempt(
      user.id,
      started.data.attemptId,
      {
        answers: row?.items.map(() => null) ?? [],
        flagged: [],
        clientSubmitId: randomUUID(),
      },
      new Date(NOW.getTime() + 120_000),
    );
    expect(done.ok).toBe(true);
    // …then like any result: stored under the question's own lesson.
    const result = await explainQuestion(
      user,
      { attemptId: started.data.attemptId, index },
      { ai, now: NOW },
    );
    if (!result.ok) throw new Error(result.code);
    await drain(result.data);
    expect((await stored()).map((s) => s.lessonId)).toEqual([lessonId]);
  });

  it("does not store a truncated answer", async () => {
    const lessonId = await addLesson();
    const user = await addUser();
    const t = await take(user, lessonId);
    const { ai } = fakeAi(["Nửa câu"], { finishReason: "MAX_TOKENS" });
    const out = await explainQuestion(
      user,
      { attemptId: t.id, index: t.mcq },
      { ai, now: NOW },
    );
    if (!out.ok) throw new Error(out.code);
    expect((await drain(out.data)).done).toEqual({ ok: true, stored: false });
    expect(await stored()).toEqual([]);
  });

  it("refuses before the answers may be shown, without calling Gemini", async () => {
    const hidden = await addLesson({ revealAnswers: "never" });
    const open = await addLesson();
    const user = await addUser();
    const { ai, client } = fakeAi();
    const done = await take(user, hidden);
    expect(
      await explainQuestion(
        user,
        { attemptId: done.id, index: done.mcq },
        { ai, now: NOW },
      ),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
    const running = await take(user, open, false);
    expect(
      await explainQuestion(
        user,
        { attemptId: running.id, index: running.mcq },
        { ai, now: NOW },
      ),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(client.generateContentStream).not.toHaveBeenCalled();
  });

  it("hides other students' attempts but lets an admin ask", async () => {
    const lessonId = await addLesson({ revealAnswers: "never" });
    const [owner, other, admin] = [
      await addUser(),
      await addUser(),
      await addUser("admin"),
    ];
    const t = await take(owner, lessonId);
    const { ai } = fakeAi();
    expect(
      await explainQuestion(
        other,
        { attemptId: t.id, index: t.mcq },
        { ai, now: NOW },
      ),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    const asAdmin = await explainQuestion(
      admin,
      { attemptId: t.id, index: t.mcq },
      { ai, now: NOW },
    );
    expect(asAdmin.ok && asAdmin.data.kind).toBe("stream");
  });

  it("refuses unknown attempts, items and teacher-explained questions", async () => {
    const lessonId = await addLesson();
    const user = await addUser();
    const t = await take(user, lessonId);
    const { ai } = fakeAi();
    const ask = (attemptId: string, index: number) =>
      explainQuestion(user, { attemptId, index }, { ai, now: NOW });
    expect(await ask(randomUUID(), 0)).toMatchObject({ code: "NOT_FOUND" });
    expect(await ask(t.id, 9)).toMatchObject({ code: "NOT_FOUND" });
    expect(await ask(t.id, t.teacher)).toMatchObject({ code: "VALIDATION" });
  });

  it("limits a student's misses per day; hits and admins are not limited", async () => {
    const lessonId = await addLesson();
    const [student, admin] = [await addUser(), await addUser("admin")];
    const t = await take(student, lessonId);
    const ta = await take(admin, lessonId);
    // Every generation fails, so each request is a miss.
    const { ai } = fakeAi([], {
      gate: async () => ({
        ok: false,
        code: "AI_UNAVAILABLE",
        reason: "disabled",
      }),
    });
    for (let i = 0; i < EXPLAIN_PER_USER_DAY; i++) {
      expect(
        await explainQuestion(
          student,
          { attemptId: t.id, index: t.mcq },
          { ai, now: NOW },
        ),
      ).toMatchObject({
        ok: false,
        code: "AI_UNAVAILABLE",
        message: explainCopy.unavailable,
      });
    }
    expect(
      await explainQuestion(
        student,
        { attemptId: t.id, index: t.mcq },
        { ai, now: NOW },
      ),
    ).toMatchObject({
      ok: false,
      code: "AI_QUOTA",
      message: explainCopy.userLimit,
    });
    for (let i = 0; i <= EXPLAIN_PER_USER_DAY; i++) {
      expect(
        await explainQuestion(
          admin,
          { attemptId: ta.id, index: ta.mcq },
          { ai, now: NOW },
        ),
      ).toMatchObject({ code: "AI_UNAVAILABLE" });
    }
    // A cached explanation is still served after the limit.
    const { ai: working } = fakeAi();
    const asAdmin = await explainQuestion(
      admin,
      { attemptId: ta.id, index: ta.mcq },
      { ai: working, now: NOW },
    );
    if (!asAdmin.ok) throw new Error(asAdmin.code);
    await drain(asAdmin.data);
    const hit = await explainQuestion(
      student,
      { attemptId: t.id, index: t.mcq },
      { ai, now: NOW },
    );
    expect(hit.ok && hit.data.kind).toBe("cached");
  });

  it("passes on the global budget's refusal", async () => {
    const lessonId = await addLesson();
    const user = await addUser();
    const t = await take(user, lessonId);
    const { ai } = fakeAi([], {
      gate: async () => ({ ok: false, code: "AI_QUOTA", reason: "budget" }),
    });
    expect(
      await explainQuestion(
        user,
        { attemptId: t.id, index: t.mcq },
        { ai, now: NOW },
      ),
    ).toMatchObject({
      ok: false,
      code: "AI_QUOTA",
      message: explainCopy.quota,
    });
  });
});

describe("voteExplanation", () => {
  async function seedExplanation() {
    const lessonId = await addLesson();
    await tdb.insert(questionExplanations).values({
      questionHash: mcqHash,
      lessonId,
      questionId: "q_mcq",
      contentMd: "Giải thích",
    });
  }

  it("sets, changes and clears one vote per student", async () => {
    await seedExplanation();
    const [a, b] = [await addUser(), await addUser()];
    expect(await voteExplanation(a, { hash: mcqHash, vote: "up" })).toEqual({
      ok: true,
      data: { votesUp: 1, votesDown: 0, vote: "up" },
    });
    expect(await voteExplanation(a, { hash: mcqHash, vote: "up" })).toEqual({
      ok: true,
      data: { votesUp: 1, votesDown: 0, vote: "up" },
    });
    expect(await voteExplanation(b, { hash: mcqHash, vote: "down" })).toEqual({
      ok: true,
      data: { votesUp: 1, votesDown: 1, vote: "down" },
    });
    expect(await voteExplanation(a, { hash: mcqHash, vote: "down" })).toEqual({
      ok: true,
      data: { votesUp: 0, votesDown: 2, vote: "down" },
    });
    expect(await voteExplanation(b, { hash: mcqHash, vote: null })).toEqual({
      ok: true,
      data: { votesUp: 0, votesDown: 1, vote: null },
    });

    const mine = await getReviewExplanations(a.id, [mcqHash, "f".repeat(64)]);
    expect([...mine.values()]).toEqual([
      {
        hash: mcqHash,
        contentMd: "Giải thích",
        reviewed: false,
        votesUp: 0,
        votesDown: 1,
        vote: "down",
      },
    ]);
    expect(
      (await getReviewExplanations(b.id, [mcqHash])).get(mcqHash)?.vote,
    ).toBe(null);
    expect((await getReviewExplanations(b.id, [])).size).toBe(0);
  });

  it("refuses an unknown explanation", async () => {
    const user = await addUser();
    expect(
      await voteExplanation(user, { hash: "a".repeat(64), vote: "up" }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});
