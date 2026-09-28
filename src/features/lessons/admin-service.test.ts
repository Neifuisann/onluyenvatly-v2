import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import {
  attempts,
  auditLog,
  lessons,
  lessonVersions,
  users,
} from "@/db/schema";
import { resetDb, type TestDb } from "@/test/db";
import { getAdminLessons, getLessonForEditing } from "./admin-queries";
import {
  createLesson,
  deleteLesson,
  duplicateLesson,
  reorderLessons,
  setArchived,
} from "./admin-service";
import { DEFAULT_LESSON_CONFIG, type Question } from "./schema";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());

const tdb = db as unknown as TestDb;

const questions: Question[] = [
  {
    id: "q_a",
    type: "mcq",
    stem: "Đơn vị của chu kì?",
    options: [{ text: "s" }, { text: "m" }],
    answer: 0,
  },
  { id: "q_b", type: "short", stem: "T = ?", answer: "2" },
];

let admin: { id: string };

async function addLesson(
  title: string,
  sortOrder: number,
  {
    status = "published",
    withVersion = false,
  }: {
    status?: "draft" | "published" | "archived";
    withVersion?: boolean;
  } = {},
) {
  const [row] = await tdb
    .insert(lessons)
    .values({
      title,
      sortOrder,
      status,
      config: DEFAULT_LESSON_CONFIG,
      tags: ["dao động"],
    })
    .returning({ id: lessons.id });
  const id = row?.id ?? 0;
  if (withVersion) {
    const [v] = await tdb
      .insert(lessonVersions)
      .values({ lessonId: id, version: 1, sourceText: "Câu 1: …", questions })
      .returning({ id: lessonVersions.id });
    await tdb
      .update(lessons)
      .set({ currentVersionId: v?.id ?? null })
      .where(eq(lessons.id, id));
  }
  return id;
}

async function addAttempt(lessonId: number) {
  await tdb.insert(attempts).values({
    userId: admin.id,
    lessonId,
    items: [],
    answers: [],
    maxScore: 0,
    status: "submitted",
  });
}

const order = async () =>
  (
    await tdb
      .select({ id: lessons.id })
      .from(lessons)
      .orderBy(asc(lessons.sortOrder), asc(lessons.id))
  ).map((r) => r.id);

const audit = () =>
  tdb
    .select({
      action: auditLog.action,
      targetId: auditLog.targetId,
      data: auditLog.data,
      actorId: auditLog.actorId,
    })
    .from(auditLog);

beforeEach(async () => {
  await resetDb(tdb);
  const [u] = await tdb
    .insert(users)
    .values({
      role: "admin",
      status: "active",
      fullName: "Cô giáo",
      username: "admin",
      passwordHash: "x",
    })
    .returning({ id: users.id });
  admin = { id: u?.id ?? "" };
});

describe("getAdminLessons", () => {
  it("lists every status in order, filters by status and accent-free search, hides deleted", async () => {
    const a = await addLesson("Dao động cơ", 0);
    const b = await addLesson("Sóng âm", 1, { status: "draft" });
    const c = await addLesson("Điện xoay chiều", 2, { status: "archived" });
    const d = await addLesson("Đã xóa", 3);
    await tdb
      .update(lessons)
      .set({ deletedAt: new Date() })
      .where(eq(lessons.id, d));

    const all = await getAdminLessons({ q: null, status: null });
    expect(all.map((r) => r.id)).toEqual([a, b, c]);
    expect(all[0]).toMatchObject({ status: "published", hasDraft: false });

    expect(
      (await getAdminLessons({ q: null, status: "draft" })).map((r) => r.id),
    ).toEqual([b]);
    expect(
      (await getAdminLessons({ q: "song am", status: null })).map((r) => r.id),
    ).toEqual([b]);
    expect(
      (await getAdminLessons({ q: "dien", status: "published" })).length,
    ).toBe(0);
  });
});

describe("reorderLessons", () => {
  it("persists the new order and writes an audit entry", async () => {
    const a = await addLesson("A", 0);
    const b = await addLesson("B", 1);
    const c = await addLesson("C", 2, { status: "draft" });

    const result = await reorderLessons(admin, [c, a, b]);
    expect(result).toEqual({ ok: true, data: { count: 3 } });
    expect(await order()).toEqual([c, a, b]);
    expect(await audit()).toEqual([
      {
        action: "lesson.reorder",
        targetId: null,
        data: { count: 3 },
        actorId: admin.id,
      },
    ]);
  });

  it("refuses a stale or partial list and changes nothing", async () => {
    const a = await addLesson("A", 0);
    const b = await addLesson("B", 1);
    const result = await reorderLessons(admin, [b]);
    expect(result).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(await reorderLessons(admin, [b, a, 999])).toMatchObject({
      ok: false,
    });
    expect(await order()).toEqual([a, b]);
    expect(await audit()).toEqual([]);
  });

  it("ignores soft-deleted lessons", async () => {
    const a = await addLesson("A", 0);
    const b = await addLesson("B", 1);
    const gone = await addLesson("Gone", 2);
    await tdb
      .update(lessons)
      .set({ deletedAt: new Date() })
      .where(eq(lessons.id, gone));
    expect((await reorderLessons(admin, [b, a])).ok).toBe(true);
    expect(await reorderLessons(admin, [b, a, gone])).toMatchObject({
      ok: false,
    });
  });
});

describe("duplicateLesson", () => {
  it("copies metadata, config and content as a draft right below the source", async () => {
    const a = await addLesson("Đề GK1", 0, { withVersion: true });
    const b = await addLesson("B", 1);

    const result = await duplicateLesson(admin, a);
    expect(result.ok).toBe(true);
    const copyId = result.ok ? result.data.id : 0;
    expect(await order()).toEqual([a, copyId, b]);

    const [copy] = await tdb
      .select()
      .from(lessons)
      .where(eq(lessons.id, copyId));
    expect(copy).toMatchObject({
      title: "Đề GK1 (bản sao)",
      status: "draft",
      tags: ["dao động"],
      config: DEFAULT_LESSON_CONFIG,
      currentVersionId: null,
      questionCount: 2,
      typeCounts: { mcq: 1, short: 1 },
      attemptCount: 0,
      createdBy: admin.id,
    });
    const [draft] = await tdb
      .select()
      .from(lessonVersions)
      .where(eq(lessonVersions.id, copy?.draftVersionId ?? 0));
    expect(draft).toMatchObject({
      lessonId: copyId,
      version: 1,
      sourceText: "Câu 1: …",
      questions,
    });
    expect(await audit()).toEqual([
      expect.objectContaining({
        action: "lesson.duplicate",
        targetId: String(copyId),
        data: { from: a },
      }),
    ]);
  });

  it("lands right below the source when orders tie", async () => {
    const a = await addLesson("A", 0);
    const b = await addLesson("B", 0);
    const c = await addLesson("C", 0);
    const d = await addLesson("D", 1);
    const result = await duplicateLesson(admin, b);
    const copy = result.ok ? result.data.id : 0;
    expect(await order()).toEqual([a, b, copy, c, d]);
  });

  it("copies a lesson without content", async () => {
    const a = await addLesson("Trống", 0, { status: "draft" });
    const result = await duplicateLesson(admin, a);
    expect(result.ok).toBe(true);
    const [copy] = await tdb
      .select({
        draft: lessons.draftVersionId,
        count: lessons.questionCount,
      })
      .from(lessons)
      .where(eq(lessons.id, result.ok ? result.data.id : 0));
    expect(copy).toEqual({ draft: null, count: 0 });
  });

  it("returns NOT_FOUND for a missing lesson", async () => {
    expect(await duplicateLesson(admin, 404)).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });
});

describe("setArchived", () => {
  it("archives, then restores to draft, with audit entries", async () => {
    const a = await addLesson("A", 0);
    expect((await setArchived(admin, a, true)).ok).toBe(true);
    expect(
      (await tdb.select().from(lessons).where(eq(lessons.id, a)))[0]?.status,
    ).toBe("archived");
    // Archiving twice is a miss, not a second audit entry.
    expect((await setArchived(admin, a, true)).ok).toBe(false);
    expect((await setArchived(admin, a, false)).ok).toBe(true);
    expect(
      (await tdb.select().from(lessons).where(eq(lessons.id, a)))[0]?.status,
    ).toBe("draft");
    expect((await audit()).map((r) => r.action)).toEqual([
      "lesson.archive",
      "lesson.restore",
    ]);
  });
});

describe("deleteLesson", () => {
  it("hard-deletes a lesson without attempts, versions included", async () => {
    const a = await addLesson("A", 0, { withVersion: true });
    expect(await deleteLesson(admin, a)).toEqual({
      ok: true,
      data: { id: a, soft: false },
    });
    expect(await tdb.select().from(lessons)).toEqual([]);
    expect(await tdb.select().from(lessonVersions)).toEqual([]);
    expect(await audit()).toEqual([
      expect.objectContaining({
        action: "lesson.delete",
        targetId: String(a),
        data: { soft: false },
      }),
    ]);
  });

  it("soft-deletes a lesson with attempts: archived, hidden, attempts kept", async () => {
    const a = await addLesson("A", 0, { withVersion: true });
    await addAttempt(a);
    expect(await deleteLesson(admin, a)).toEqual({
      ok: true,
      data: { id: a, soft: true },
    });
    const [row] = await tdb.select().from(lessons).where(eq(lessons.id, a));
    expect(row?.status).toBe("archived");
    expect(row?.deletedAt).toBeInstanceOf(Date);
    expect(await tdb.select().from(attempts)).toHaveLength(1);
    expect(await getAdminLessons({ q: null, status: null })).toEqual([]);
    // Already deleted.
    expect(await deleteLesson(admin, a)).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });
});

describe("createLesson", () => {
  it("adds an empty draft at the end with an audit entry", async () => {
    const a = await addLesson("A", 5);
    const { id } = await createLesson(admin);
    expect(await order()).toEqual([a, id]);
    const [row] = await tdb.select().from(lessons).where(eq(lessons.id, id));
    expect(row).toMatchObject({
      title: "Bài tập mới",
      status: "draft",
      sortOrder: 6,
      config: DEFAULT_LESSON_CONFIG,
      currentVersionId: null,
      draftVersionId: null,
      createdBy: admin.id,
    });
    expect((await audit()).map((r) => r.action)).toEqual(["lesson.create"]);
  });
});

describe("getLessonForEditing", () => {
  it("opens the draft when there is one, else the published version", async () => {
    const a = await addLesson("A", 0, { withVersion: true });
    expect(await getLessonForEditing(a)).toMatchObject({
      title: "A",
      sourceText: "Câu 1: …",
      questions,
      hasDraft: false,
      hasPublished: true,
    });
    const [draft] = await tdb
      .insert(lessonVersions)
      .values({ lessonId: a, version: 2, sourceText: "nháp", questions: [] })
      .returning({ id: lessonVersions.id });
    await tdb
      .update(lessons)
      .set({ draftVersionId: draft?.id ?? null })
      .where(eq(lessons.id, a));
    expect(await getLessonForEditing(a)).toMatchObject({
      sourceText: "nháp",
      questions: [],
      hasDraft: true,
    });
  });

  it("gives an empty text for a new lesson and null for a deleted one", async () => {
    const { id } = await createLesson(admin);
    expect(await getLessonForEditing(id)).toMatchObject({
      sourceText: "",
      questions: [],
      hasDraft: false,
      hasPublished: false,
    });
    await tdb
      .update(lessons)
      .set({ deletedAt: new Date() })
      .where(eq(lessons.id, id));
    expect(await getLessonForEditing(id)).toBeNull();
  });
});
