import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { attempts, auditLog, lessons, ratings, users } from "@/db/schema";
import { createSession } from "@/features/auth/session";
import { DEFAULT_LESSON_CONFIG } from "@/features/lessons/schema";
import { resetDb, type TestDb } from "@/test/db";
import {
  getPendingStudents,
  getStudentAttempts,
  getStudentDetail,
  getStudentSessions,
  getStudents,
} from "./admin-queries";
import { approveStudents, rejectStudents } from "./admin-service";
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

  it("gives a student's detail with rating, attempts and sessions", async () => {
    const id = await addStudent("Nguyễn Văn An", { phone: "0912345678" });
    const l1 = await addLesson("Bài một");
    await addAttempt(id, l1);
    await addAttempt(id, l1, "in_progress");
    await tdb
      .insert(ratings)
      .values({ userId: id, rating: 1620, peak: 1700, ratedAttempts: 4 });
    await createSession(id, meta);

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
