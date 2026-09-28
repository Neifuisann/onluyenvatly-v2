import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import {
  attemptOverrides,
  attempts,
  auditLog,
  lessons,
  lessonVersions,
  mistakes,
  ratingEvents,
  ratings,
  sessions,
  users,
} from "@/db/schema";
import { verifyPassword } from "@/features/auth/core/password";
import { createSession } from "@/features/auth/session";
import { DEFAULT_LESSON_CONFIG } from "@/features/lessons/schema";
import { resetDb, type TestDb } from "@/test/db";
import {
  getGrantableLessons,
  getPendingStudents,
  getStudentAttempts,
  getStudentDetail,
  getStudentOverrides,
  getStudentSessions,
  getStudents,
} from "./admin-queries";
import {
  approveStudents,
  createAdmin,
  deleteStudent,
  grantExtraAttempts,
  rejectStudents,
  resetStudentPassword,
  revokeStudentSessions,
  setStudentStatus,
} from "./admin-service";
import { parseStudentListParams } from "./domain/list";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
// `"use cache"` is a no-op outside Next; stub the tag helpers.
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

const tdb = db as unknown as TestDb;
const meta = { ip: "203.0.113.7", userAgent: "vitest" };

let admin: { id: string };

let phoneSeq = 0;
async function addStudent(
  fullName: string,
  values: Partial<typeof users.$inferInsert> = {},
) {
  const [row] = await tdb
    .insert(users)
    .values({
      fullName,
      phone: `09${String(++phoneSeq).padStart(8, "0")}`,
      passwordHash: "x",
      status: "active",
      ...values,
    })
    .returning({ id: users.id });
  return row?.id ?? "";
}

async function addLesson(title: string, attemptCount = 0) {
  const [row] = await tdb
    .insert(lessons)
    .values({
      title,
      status: "published",
      config: DEFAULT_LESSON_CONFIG,
      attemptCount,
    })
    .returning({ id: lessons.id });
  return row?.id ?? 0;
}

async function addAttempt(
  userId: string,
  lessonId: number,
  status: "submitted" | "in_progress" = "submitted",
) {
  const [row] = await tdb
    .insert(attempts)
    .values({
      userId,
      lessonId,
      items: [],
      answers: [],
      maxScore: 10,
      score10: 7.5,
      status,
      submittedAt: status === "submitted" ? new Date() : null,
    })
    .returning({ id: attempts.id });
  return row?.id ?? "";
}

const audits = () => tdb.select().from(auditLog).orderBy(asc(auditLog.id));
const userRow = async (id: string) =>
  (await tdb.select().from(users).where(eq(users.id, id)))[0];

beforeEach(async () => {
  await resetDb(tdb);
  const [a] = await tdb
    .insert(users)
    .values({
      role: "admin",
      status: "active",
      fullName: "Giáo viên",
      username: "gv",
      passwordHash: "x",
    })
    .returning({ id: users.id });
  admin = { id: a?.id ?? "" };
});

describe("approveStudents / rejectStudents", () => {
  it("approves pending students, stamps who and when, one audit row each", async () => {
    const a = await addStudent("A", { status: "pending" });
    const b = await addStudent("B", { status: "pending" });
    const now = new Date("2026-09-29T03:00:00Z");
    const result = await approveStudents(admin, [a, b], now);
    expect(result).toEqual({ ok: true, data: { done: 2, skipped: 0 } });
    const row = await userRow(a);
    expect(row).toMatchObject({ status: "active", approvedBy: admin.id });
    expect(row?.approvedAt?.getTime()).toBe(now.getTime());
    const log = await audits();
    expect(log.map((r) => [r.action, r.targetType, r.targetId])).toEqual([
      ["student.approve", "user", a],
      ["student.approve", "user", b],
    ]);
    expect(log.every((r) => r.actorId === admin.id && r.data === null)).toBe(
      true,
    );
  });

  it("skips and counts students who are not pending, and never touches admins", async () => {
    const pending = await addStudent("P", { status: "pending" });
    const active = await addStudent("A", { status: "active" });
    const rejected = await addStudent("R", { status: "rejected" });
    const result = await approveStudents(admin, [
      pending,
      active,
      rejected,
      admin.id,
      "00000000-0000-4000-8000-000000000000",
    ]);
    expect(result).toEqual({ ok: true, data: { done: 1, skipped: 4 } });
    expect((await userRow(rejected))?.status).toBe("rejected");
    expect((await audits()).map((r) => r.targetId)).toEqual([pending]);
  });

  it("rejects pending students and writes nothing when there is nothing to do", async () => {
    const pending = await addStudent("P", { status: "pending" });
    const active = await addStudent("A");
    expect(await rejectStudents(admin, [pending, active])).toEqual({
      ok: true,
      data: { done: 1, skipped: 1 },
    });
    expect((await userRow(pending))?.status).toBe("rejected");
    expect((await userRow(active))?.status).toBe("active");
    expect((await audits()).map((r) => r.action)).toEqual(["student.reject"]);

    await rejectStudents(admin, [active]);
    expect(await audits()).toHaveLength(1);
  });

  it("a second approve of the same student is a no-op", async () => {
    const a = await addStudent("A", { status: "pending" });
    await approveStudents(admin, [a]);
    expect(await approveStudents(admin, [a])).toEqual({
      ok: true,
      data: { done: 0, skipped: 1 },
    });
    expect(await audits()).toHaveLength(1);
  });
});

describe("resetStudentPassword", () => {
  it("sets a verifiable temporary password, the flag, revokes sessions, audits without it", async () => {
    const id = await addStudent("A", { phone: "0912345678" });
    await createSession(id, meta);
    await createSession(id, meta);
    const other = await addStudent("B");
    await createSession(other, meta);

    const result = await resetStudentPassword(admin, id);
    if (!result.ok) throw new Error("expected ok");
    const { password } = result.data;
    expect(password).toHaveLength(10);

    const row = await userRow(id);
    expect(row?.mustChangePassword).toBe(true);
    expect(await verifyPassword(password, row?.passwordHash)).toBe(true);
    const left = await tdb.select().from(sessions);
    expect(left.map((s) => s.userId)).toEqual([other]);

    const [entry] = await audits();
    expect(entry).toMatchObject({
      action: "student.reset_password",
      targetId: id,
      data: { revokedSessions: 2 },
    });
    expect(JSON.stringify(entry)).not.toContain(password);
  });

  it("uses the injected random source", async () => {
    const id = await addStudent("A");
    let i = 0;
    const digits = [0, 48, 1, 49, 2, 50, 3, 51, 4, 52];
    const result = await resetStudentPassword(
      admin,
      id,
      (max) => (digits[i++ % digits.length] ?? 0) % max,
    );
    expect(result).toEqual({ ok: true, data: { password: "A2B3C4D5E6" } });
  });

  it("only resets students, never an admin or oneself", async () => {
    expect(await resetStudentPassword(admin, admin.id)).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
    const [other] = await tdb
      .insert(users)
      .values({
        role: "admin",
        fullName: "Khác",
        username: "khac",
        passwordHash: "keep",
      })
      .returning({ id: users.id });
    expect(await resetStudentPassword(admin, other?.id ?? "")).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    expect((await userRow(other?.id ?? ""))?.passwordHash).toBe("keep");
    expect(
      await resetStudentPassword(admin, "00000000-0000-4000-8000-000000000000"),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await audits()).toHaveLength(0);
  });
});

describe("revokeStudentSessions", () => {
  it("logs the student out everywhere and counts them", async () => {
    const id = await addStudent("A");
    await createSession(id, meta);
    await createSession(id, meta);
    const other = await addStudent("B");
    await createSession(other, meta);
    expect(await revokeStudentSessions(admin, id)).toEqual({
      ok: true,
      data: { revoked: 2 },
    });
    expect(await tdb.select().from(sessions)).toHaveLength(1);
    expect((await audits()).map((r) => [r.action, r.data])).toEqual([
      ["student.revoke_sessions", { count: 2 }],
    ]);
  });

  it("refuses admins, oneself and unknown ids", async () => {
    expect(await revokeStudentSessions(admin, admin.id)).toMatchObject({
      code: "FORBIDDEN",
    });
    expect(
      await revokeStudentSessions(
        admin,
        "00000000-0000-4000-8000-000000000000",
      ),
    ).toMatchObject({ code: "NOT_FOUND" });
    expect(await audits()).toHaveLength(0);
  });
});

describe("setStudentStatus", () => {
  it("disables an active student, revoking sessions, and re-enables them", async () => {
    const id = await addStudent("A");
    await createSession(id, meta);
    expect(await setStudentStatus(admin, id, "disabled")).toEqual({
      ok: true,
      data: { status: "disabled" },
    });
    expect((await userRow(id))?.status).toBe("disabled");
    expect(await tdb.select().from(sessions)).toHaveLength(0);

    expect(await setStudentStatus(admin, id, "active")).toMatchObject({
      ok: true,
    });
    expect((await userRow(id))?.status).toBe("active");
    expect((await audits()).map((r) => [r.action, r.data])).toEqual([
      ["student.disable", { from: "active", revokedSessions: 1 }],
      ["student.enable", { from: "disabled", revokedSessions: 0 }],
    ]);
  });

  it("approves a wrongly rejected student when re-enabled", async () => {
    const id = await addStudent("A", { status: "rejected" });
    await setStudentStatus(
      admin,
      id,
      "active",
      new Date("2026-09-29T00:00:00Z"),
    );
    expect(await userRow(id)).toMatchObject({
      status: "active",
      approvedBy: admin.id,
    });
  });

  it("refuses changes the transition rules don't allow", async () => {
    const pending = await addStudent("P", { status: "pending" });
    const active = await addStudent("A");
    expect(await setStudentStatus(admin, pending, "active")).toMatchObject({
      ok: false,
      code: "CONFLICT",
    });
    expect(await setStudentStatus(admin, active, "active")).toMatchObject({
      ok: false,
      code: "CONFLICT",
    });
    expect(await setStudentStatus(admin, admin.id, "disabled")).toMatchObject({
      code: "FORBIDDEN",
    });
    expect((await userRow(pending))?.status).toBe("pending");
    expect(await audits()).toHaveLength(0);
  });
});

describe("deleteStudent", () => {
  it("needs the student's name typed", async () => {
    const id = await addStudent("Nguyễn Văn An");
    const result = await deleteStudent(admin, id, "Văn Bình");
    expect(result).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { confirmName: expect.any(String) },
    });
    expect(await userRow(id)).toBeDefined();
    expect(await audits()).toHaveLength(0);
  });

  it("deletes everything of theirs, recomputes lesson counts, audits counts only", async () => {
    const id = await addStudent("Nguyễn Văn An", { phone: "0912345678" });
    const other = await addStudent("Trần Thị Bình");
    // Lesson 1: 1 attempt by each; lesson 2: only the deleted student's.
    const l1 = await addLesson("Một", 2);
    const l2 = await addLesson("Hai", 1);
    const l3 = await addLesson("Ba", 5);
    const mine = await addAttempt(id, l1);
    await addAttempt(id, l2);
    await addAttempt(id, l3, "in_progress");
    await addAttempt(other, l1);
    await tdb.insert(ratings).values({ userId: id, rating: 1600, peak: 1600 });
    await tdb.insert(ratingEvents).values({
      userId: id,
      attemptId: mine,
      before: 1500,
      delta: 100,
      after: 1600,
      formula: "v2",
    });
    const [version] = await tdb
      .insert(lessonVersions)
      .values({ lessonId: l1, version: 1, sourceText: "", questions: [] })
      .returning({ id: lessonVersions.id });
    await tdb.insert(mistakes).values({
      userId: id,
      lessonId: l1,
      questionId: "q1",
      lessonVersionId: version?.id ?? 0,
      lastAttemptId: mine,
    });
    await tdb
      .insert(attemptOverrides)
      .values({ userId: id, lessonId: l1, extraAttempts: 2 });
    await createSession(id, meta);

    const result = await deleteStudent(admin, id, "  nguyễn văn AN ");
    expect(result).toEqual({ ok: true, data: { attempts: 3, lessons: 2 } });

    expect(await userRow(id)).toBeUndefined();
    for (const table of [
      ratings,
      ratingEvents,
      mistakes,
      attemptOverrides,
      sessions,
    ])
      expect(await tdb.select().from(table)).toHaveLength(0);
    expect(await tdb.select().from(attempts)).toHaveLength(1);

    const counts = await tdb
      .select({ id: lessons.id, n: lessons.attemptCount })
      .from(lessons)
      .orderBy(asc(lessons.id));
    // Recomputed from the attempts left; the untouched lesson keeps its number.
    expect(counts).toEqual([
      { id: l1, n: 1 },
      { id: l2, n: 0 },
      { id: l3, n: 5 },
    ]);

    const log = await audits();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      action: "student.delete",
      targetId: id,
      data: { attempts: 3, lessons: 2 },
    });
    const text = JSON.stringify(log[0]);
    expect(text).not.toContain("Nguyễn");
    expect(text).not.toContain("0912345678");
  });

  it("refuses admins, oneself and unknown ids", async () => {
    expect(await deleteStudent(admin, admin.id, "Giáo viên")).toMatchObject({
      code: "FORBIDDEN",
    });
    const [other] = await tdb
      .insert(users)
      .values({
        role: "admin",
        fullName: "Khác",
        username: "khac",
        passwordHash: "x",
      })
      .returning({ id: users.id });
    expect(await deleteStudent(admin, other?.id ?? "", "Khác")).toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await userRow(other?.id ?? "")).toBeDefined();
  });
});

describe("grantExtraAttempts", () => {
  it("upserts one grant per student and lesson", async () => {
    const id = await addStudent("A");
    const lessonId = await addLesson("Bài");
    expect(
      await grantExtraAttempts(admin, { userId: id, lessonId, extra: 2 }),
    ).toEqual({ ok: true, data: { extra: 2 } });
    await grantExtraAttempts(admin, { userId: id, lessonId, extra: 5 });
    const rows = await tdb.select().from(attemptOverrides);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ extraAttempts: 5, grantedBy: admin.id });
    expect((await audits()).map((r) => [r.action, r.data])).toEqual([
      ["student.grant_attempts", { lessonId, extra: 2 }],
      ["student.grant_attempts", { lessonId, extra: 5 }],
    ]);
  });

  it("removes the grant with 0", async () => {
    const id = await addStudent("A");
    const lessonId = await addLesson("Bài");
    await grantExtraAttempts(admin, { userId: id, lessonId, extra: 2 });
    await grantExtraAttempts(admin, { userId: id, lessonId, extra: 0 });
    expect(await tdb.select().from(attemptOverrides)).toHaveLength(0);
    expect((await audits()).at(-1)?.action).toBe("student.revoke_attempts");
  });

  it("needs a student and a lesson that exists and isn't deleted", async () => {
    const id = await addStudent("A");
    const lessonId = await addLesson("Bài");
    await tdb
      .update(lessons)
      .set({ deletedAt: new Date() })
      .where(eq(lessons.id, lessonId));
    expect(
      await grantExtraAttempts(admin, { userId: id, lessonId, extra: 1 }),
    ).toMatchObject({ code: "NOT_FOUND" });
    expect(
      await grantExtraAttempts(admin, {
        userId: "00000000-0000-4000-8000-000000000000",
        lessonId,
        extra: 1,
      }),
    ).toMatchObject({ code: "NOT_FOUND" });
    expect(
      await grantExtraAttempts(admin, {
        userId: admin.id,
        lessonId,
        extra: 1,
      }),
    ).toMatchObject({ code: "FORBIDDEN" });
    expect(await audits()).toHaveLength(0);
  });
});

describe("createAdmin", () => {
  it("creates an active admin who can log in by username", async () => {
    const result = await createAdmin(admin, {
      fullName: "Cô Hoa",
      username: "co.hoa",
      password: "vatly-2026",
    });
    if (!result.ok) throw new Error("expected ok");
    const row = await userRow(result.data.id);
    expect(row).toMatchObject({
      role: "admin",
      status: "active",
      username: "co.hoa",
      phone: null,
      approvedBy: admin.id,
    });
    expect(await verifyPassword("vatly-2026", row?.passwordHash)).toBe(true);
    const [entry] = await audits();
    expect(entry).toMatchObject({
      action: "admin.create",
      targetId: result.data.id,
      data: null,
    });
  });

  it("refuses a username that is taken", async () => {
    const input = {
      fullName: "Cô Hoa",
      username: "gv",
      password: "vatly-2026",
    };
    expect(await createAdmin(admin, input)).toMatchObject({
      ok: false,
      code: "CONFLICT",
      fieldErrors: { username: expect.any(String) },
    });
    expect(await audits()).toHaveLength(0);
  });
});

describe("student queries", () => {
  it("lists pending students oldest first and flags more than 200", async () => {
    await addStudent("Sau", {
      status: "pending",
      createdAt: new Date("2026-09-02T00:00:00Z"),
    });
    await addStudent("Trước", {
      status: "pending",
      createdAt: new Date("2026-09-01T00:00:00Z"),
    });
    await addStudent("Đã duyệt");
    const { rows, hasMore } = await getPendingStudents();
    expect(rows.map((r) => r.fullName)).toEqual(["Trước", "Sau"]);
    expect(hasMore).toBe(false);
  });

  it("searches names without accents and phones by prefix, only among students", async () => {
    await addStudent("Nguyễn Văn An", { phone: "0912345678", grade: 12 });
    await addStudent("Nguyễn Thị Bình", { phone: "0987000111", grade: 11 });
    await addStudent("Lê Văn Cường", {
      phone: "0912999000",
      grade: 12,
      status: "disabled",
    });
    const list = (params: Record<string, string>) =>
      getStudents(parseStudentListParams({ view: "all", ...params })).then(
        (r) => r.rows.map((s) => s.fullName),
      );

    expect(await list({})).toEqual([
      "Lê Văn Cường",
      "Nguyễn Thị Bình",
      "Nguyễn Văn An",
    ]);
    expect(await list({ q: "nguyen" })).toEqual([
      "Nguyễn Thị Bình",
      "Nguyễn Văn An",
    ]);
    expect(await list({ q: "van nguyen" })).toEqual(["Nguyễn Văn An"]);
    expect(await list({ q: "0912" })).toEqual([
      "Lê Văn Cường",
      "Nguyễn Văn An",
    ]);
    expect(await list({ q: "+84 912 345" })).toEqual(["Nguyễn Văn An"]);
    expect(await list({ q: "100%" })).toEqual([]);
    expect(await list({ grade: "12", status: "active" })).toEqual([
      "Nguyễn Văn An",
    ]);
    expect(await list({ status: "disabled" })).toEqual(["Lê Văn Cường"]);
    // The admin is never listed.
    expect(await list({ q: "Giáo" })).toEqual([]);
  });

  it("pages cumulatively and reports the total", async () => {
    for (let i = 0; i < 53; i++)
      await addStudent(`Học sinh ${String(i).padStart(2, "0")}`);
    const first = await getStudents(parseStudentListParams({ view: "all" }));
    expect(first.rows).toHaveLength(50);
    expect(first.total).toBe(53);
    const second = await getStudents(
      parseStudentListParams({ view: "all", page: "2" }),
    );
    expect(second.rows).toHaveLength(53);
  });

  it("gives a student's detail with rating, attempts, sessions, grants and lessons", async () => {
    const id = await addStudent("Nguyễn Văn An", { phone: "0912345678" });
    const l1 = await addLesson("Bài một");
    const l2 = await addLesson("Bài hai");
    await addAttempt(id, l1);
    await addAttempt(id, l1, "in_progress");
    await tdb
      .insert(ratings)
      .values({ userId: id, rating: 1620, peak: 1700, ratedAttempts: 4 });
    await createSession(id, meta);
    await tdb
      .insert(attemptOverrides)
      .values({ userId: id, lessonId: l2, extraAttempts: 3 });

    expect(await getStudentDetail(id)).toMatchObject({
      id,
      fullName: "Nguyễn Văn An",
      phone: "0912345678",
      status: "active",
      rating: { rating: 1620, peak: 1700, ratedAttempts: 4 },
      attemptTotal: 1,
    });
    expect((await getStudentAttempts(id)).map((a) => a.lessonTitle)).toEqual([
      "Bài một",
    ]);
    const [session] = await getStudentSessions(id);
    expect(session).toMatchObject({ userAgent: "vitest" });
    expect(await getStudentOverrides(id)).toEqual([
      { lessonId: l2, lessonTitle: "Bài hai", extraAttempts: 3 },
    ]);
    expect(await getGrantableLessons(id)).toEqual([
      { id: l1, title: "Bài một", attempted: true },
      { id: l2, title: "Bài hai", attempted: false },
    ]);
  });

  it("has no detail for an admin or an unknown id, and hides expired sessions", async () => {
    expect(await getStudentDetail(admin.id)).toBeNull();
    expect(
      await getStudentDetail("00000000-0000-4000-8000-000000000000"),
    ).toBeNull();
    const id = await addStudent("A");
    await createSession(id, meta, new Date("2026-01-01T00:00:00Z"));
    expect(
      await getStudentSessions(id, new Date("2026-09-29T00:00:00Z")),
    ).toEqual([]);
  });

  it("gives an unrated student no rating", async () => {
    const id = await addStudent("A");
    expect((await getStudentDetail(id))?.rating).toBeNull();
  });
});
