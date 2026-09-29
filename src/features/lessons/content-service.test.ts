import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import {
  attempts,
  auditLog,
  lessons,
  lessonVersions,
  users,
} from "@/db/schema";
import { startAttempt, submitAttempt } from "@/features/attempts/service";
import { resetDb, type TestDb } from "@/test/db";
import {
  discardDraft,
  publishLesson,
  saveDraft,
  unpublishLesson,
} from "./content-service";
import { DEFAULT_LESSON_CONFIG, type Question } from "./schema";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

const tdb = db as unknown as TestDb;

const V1 = `Câu 1: Đơn vị của chu kì là
*A. s
B. m

Câu 2: Tính T (s).
Answer: 2`;

// Same first question, a new answer for the second, one question more.
const V2 = `Câu 1: Đơn vị của chu kì là
*A. s
B. m

Câu 2: Tính T (s).
Answer: 3

Câu 3: Đơn vị của tần số là
A. s
*B. Hz`;

let admin: { id: string; role: "admin" };
let student: { id: string; role: "student" };

async function addUser(role: "student" | "admin", phone: string) {
  const [u] = await tdb
    .insert(users)
    .values({
      role,
      status: "active",
      fullName: role,
      phone,
      passwordHash: "x",
    })
    .returning({ id: users.id });
  return u?.id ?? "";
}

async function addLesson(status: "draft" | "published" | "archived" = "draft") {
  const [row] = await tdb
    .insert(lessons)
    .values({ title: "Bài", status, config: DEFAULT_LESSON_CONFIG })
    .returning({ id: lessons.id });
  return row?.id ?? 0;
}

const lessonRow = async (id: number) => {
  const [row] = await tdb.select().from(lessons).where(eq(lessons.id, id));
  if (!row) throw new Error("lesson missing");
  return row;
};

const versions = (lessonId: number) =>
  tdb
    .select({
      id: lessonVersions.id,
      version: lessonVersions.version,
      sourceText: lessonVersions.sourceText,
      questions: lessonVersions.questions,
    })
    .from(lessonVersions)
    .where(eq(lessonVersions.lessonId, lessonId))
    .orderBy(lessonVersions.id);

const actions = async () =>
  (await tdb.select({ action: auditLog.action }).from(auditLog)).map(
    (r) => r.action,
  );

beforeEach(async () => {
  await resetDb(tdb);
  admin = { id: await addUser("admin", "0911111111"), role: "admin" };
  student = { id: await addUser("student", "0922222222"), role: "student" };
});

describe("saveDraft", () => {
  it("creates one draft row, then overwrites it in place with stable ids", async () => {
    const id = await addLesson();
    const first = await saveDraft(admin, id, V1);
    expect(first).toEqual({ ok: true, data: { unchanged: false, errors: 0 } });
    const [v] = await versions(id);
    expect(v?.version).toBe(1);
    expect((await lessonRow(id)).draftVersionId).toBe(v?.id);
    const ids = (v?.questions as Question[]).map((q) => q.id);
    expect(ids).toHaveLength(2);
    for (const qid of ids) expect(qid).toMatch(/^q_[A-Za-z0-9]{8}$/);

    await saveDraft(admin, id, V2);
    const after = await versions(id);
    expect(after).toHaveLength(1);
    expect(after[0]?.id).toBe(v?.id);
    expect(after[0]?.sourceText).toBe(V2);
    const newIds = (after[0]?.questions as Question[]).map((q) => q.id);
    expect(newIds.slice(0, 2)).toEqual(ids);
    expect(newIds).toHaveLength(3);
    expect(await actions()).toEqual(["lesson.save_draft", "lesson.save_draft"]);
  });

  it("saves text with errors, keeping only the valid questions", async () => {
    const id = await addLesson();
    const result = await saveDraft(
      admin,
      id,
      `${V1}\n\nCâu 3: Không có đáp án\nA. x\nB. y`,
    );
    expect(result).toEqual({ ok: true, data: { unchanged: false, errors: 1 } });
    const [v] = await versions(id);
    expect(v?.questions).toHaveLength(2);
  });

  it("writes nothing when the text equals the published one", async () => {
    const id = await addLesson();
    await publishLesson(admin, id, V1);
    expect(await saveDraft(admin, id, V1)).toEqual({
      ok: true,
      data: { unchanged: true, errors: 0 },
    });
    expect((await lessonRow(id)).draftVersionId).toBeNull();
  });

  it("refuses unknown and deleted lessons", async () => {
    expect((await saveDraft(admin, 999, V1)).ok).toBe(false);
    const id = await addLesson();
    await tdb
      .update(lessons)
      .set({ deletedAt: new Date() })
      .where(eq(lessons.id, id));
    expect(await saveDraft(admin, id, V1)).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("publishLesson", () => {
  it("publishes a first version with card counts", async () => {
    const id = await addLesson();
    const result = await publishLesson(admin, id, V1);
    expect(result).toMatchObject({
      ok: true,
      data: { version: 1, retired: false },
    });
    const row = await lessonRow(id);
    expect(row).toMatchObject({
      status: "published",
      draftVersionId: null,
      questionCount: 2,
      typeCounts: { mcq: 1, short: 1 },
    });
    expect(row.currentVersionId).toBe(result.ok ? result.data.versionId : -1);
    expect(row.publishedAt).not.toBeNull();
    expect(await actions()).toEqual(["lesson.publish"]);
  });

  it("refuses text with errors, no questions, or a pool that doesn't fit, writing nothing", async () => {
    const id = await addLesson();
    const bad = await publishLesson(admin, id, "Câu 1: x\nA. a\nB. b");
    expect(bad).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(bad.ok ? "" : bad.message).toMatch(/còn 1 lỗi/);
    expect(await publishLesson(admin, id, "")).toMatchObject({
      message: "Bài chưa có câu hỏi nào.",
    });
    await tdb
      .update(lessons)
      .set({
        config: { ...DEFAULT_LESSON_CONFIG, pool: { enabled: true, size: 5 } },
      })
      .where(eq(lessons.id, id));
    const pool = await publishLesson(admin, id, V1);
    expect(pool.ok ? "" : pool.message).toMatch(/lấy 5 câu .* chỉ có 2 câu/);
    expect(await versions(id)).toHaveLength(0);
    expect((await lessonRow(id)).status).toBe("draft");
  });

  it("publishes the saved draft when no text is given", async () => {
    const id = await addLesson();
    await saveDraft(admin, id, V1);
    const result = await publishLesson(admin, id);
    expect(result).toMatchObject({ ok: true, data: { version: 1 } });
    expect(await versions(id)).toHaveLength(1);
  });

  it("replaces an unused version in place of its number (no version growth)", async () => {
    const id = await addLesson();
    await publishLesson(admin, id, V1);
    const result = await publishLesson(admin, id, V2);
    expect(result).toMatchObject({
      ok: true,
      data: { version: 1, retired: true },
    });
    const all = await versions(id);
    expect(all).toHaveLength(1);
    expect(all[0]?.sourceText).toBe(V2);
    expect((await lessonRow(id)).questionCount).toBe(3);
  });

  it("keeps a version attempts use: an old attempt is graded on the old version (journey 7)", async () => {
    const id = await addLesson();
    await publishLesson(admin, id, V1);
    const started = await startAttempt(student, id, { ip: null, seed: 1 });
    if (!started.ok) throw new Error("start failed");
    const [attempt] = await tdb
      .select({ versionId: attempts.lessonVersionId })
      .from(attempts)
      .where(eq(attempts.id, started.data.attemptId));

    const result = await publishLesson(admin, id, V2);
    expect(result).toMatchObject({
      ok: true,
      data: { version: 2, retired: false },
    });
    expect(await versions(id)).toHaveLength(2);
    expect((await lessonRow(id)).currentVersionId).not.toBe(attempt?.versionId);

    // "2" is right on version 1 and wrong on version 2.
    const submitted = await submitAttempt(student.id, started.data.attemptId, {
      answers: ["A", "2"],
      flagged: [],
      clientSubmitId: crypto.randomUUID(),
    });
    expect(submitted).toMatchObject({
      ok: true,
      data: { score: 2, maxScore: 2 },
    });

    // A new attempt starts on version 2 with its 3 questions.
    const next = await startAttempt(student, id, { ip: null, seed: 2 });
    if (!next.ok) throw new Error("second start failed");
    const [row] = await tdb
      .select({ items: attempts.items, versionId: attempts.lessonVersionId })
      .from(attempts)
      .where(eq(attempts.id, next.data.attemptId));
    expect(row?.items).toHaveLength(3);
    expect(row?.versionId).toBe(result.ok ? result.data.versionId : -1);
  });

  it("keeps a version the mistakes bank still uses after its attempt is deleted (S7-06)", async () => {
    const id = await addLesson();
    await publishLesson(admin, id, V1);
    const started = await startAttempt(student, id, { ip: null, seed: 1 });
    if (!started.ok) throw new Error("start failed");
    await submitAttempt(student.id, started.data.attemptId, {
      answers: [null, null],
      flagged: [],
      clientSubmitId: crypto.randomUUID(),
    });
    // The teacher deletes the attempt; its mistakes stay (S6-04).
    await tdb.delete(attempts).where(eq(attempts.id, started.data.attemptId));
    const result = await publishLesson(admin, id, V2);
    expect(result).toMatchObject({
      ok: true,
      data: { version: 2, retired: false },
    });
    expect(await versions(id)).toHaveLength(2);
  });

  it("re-publishes the current version after unpublishing", async () => {
    const id = await addLesson();
    await publishLesson(admin, id, V1);
    expect(await unpublishLesson(admin, id)).toEqual({
      ok: true,
      data: { id },
    });
    expect((await lessonRow(id)).status).toBe("draft");
    expect(await unpublishLesson(admin, id)).toMatchObject({
      code: "CONFLICT",
    });
    expect(await publishLesson(admin, id)).toMatchObject({
      ok: true,
      data: { version: 1, retired: false },
    });
    expect((await lessonRow(id)).status).toBe("published");
    expect(await actions()).toEqual([
      "lesson.publish",
      "lesson.unpublish",
      "lesson.publish",
    ]);
  });

  it("refuses archived lessons and lessons with nothing to publish", async () => {
    const archived = await addLesson("archived");
    expect(await publishLesson(admin, archived, V1)).toMatchObject({
      code: "CONFLICT",
    });
    const empty = await addLesson();
    expect(await publishLesson(admin, empty)).toMatchObject({
      code: "VALIDATION",
      message: "Bài chưa có nội dung để xuất bản.",
    });
    expect(await publishLesson(admin, 999, V1)).toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("discardDraft", () => {
  it("drops the draft and falls back to the published version", async () => {
    const id = await addLesson();
    await publishLesson(admin, id, V1);
    await saveDraft(admin, id, V2);
    expect(await versions(id)).toHaveLength(2);
    expect(await discardDraft(admin, id)).toEqual({ ok: true, data: { id } });
    const all = await versions(id);
    expect(all).toHaveLength(1);
    expect(all[0]?.sourceText).toBe(V1);
    expect((await lessonRow(id)).draftVersionId).toBeNull();
    expect(await discardDraft(admin, id)).toMatchObject({ code: "CONFLICT" });
  });

  it("keeps the only content of a never-published lesson", async () => {
    const id = await addLesson();
    await saveDraft(admin, id, V1);
    expect(await discardDraft(admin, id)).toMatchObject({ code: "CONFLICT" });
    expect(await discardDraft(admin, 999)).toMatchObject({ code: "NOT_FOUND" });
  });
});
