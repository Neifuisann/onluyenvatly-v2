import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import {
  auditLog,
  classes,
  classLessons,
  classMembers,
  lessons,
  users,
} from "@/db/schema";
import { DEFAULT_LESSON_CONFIG } from "@/features/lessons/schema";
import { resetDb, type TestDb } from "@/test/db";
import {
  canOpenLesson,
  countTeacherStudents,
  getClassLessonIds,
  getClassMembers,
  getStudentClass,
  getStudentClasses,
  getTeacherClass,
  getTeacherClasses,
} from "./queries";
import {
  addMembers,
  createClass,
  deleteClass,
  removeMember,
  setClassArchived,
  setClassLessons,
  updateClass,
} from "./service";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());

const tdb = db as unknown as TestDb;
const NOW = new Date("2026-10-20T02:00:00Z");
const form = {
  name: "Vật lý 12A1",
  subject: "physics" as const,
  grade: 12 as const,
  description: null,
};

type Staff = { id: string; role: "teacher" | "admin" };
let teacher: Staff;
let other: Staff;
let seq = 0;

async function addUser(
  role: "student" | "teacher" | "admin",
  values: Partial<typeof users.$inferInsert> = {},
) {
  const [u] = await tdb
    .insert(users)
    .values({
      role,
      status: "active",
      fullName: `${role} ${++seq}`,
      phone: `09${String(10_000_000 + seq).slice(-8)}`,
      passwordHash: "x",
      ...values,
    })
    .returning({ id: users.id, phone: users.phone });
  if (!u) throw new Error("seed");
  return { id: u.id, phone: u.phone ?? "" };
}

async function addLesson(
  ownerId: string,
  status: "draft" | "published" = "published",
) {
  const [l] = await tdb
    .insert(lessons)
    .values({ title: "Bài", status, config: DEFAULT_LESSON_CONFIG, ownerId })
    .returning({ id: lessons.id });
  return l?.id ?? 0;
}

const audit = () =>
  tdb
    .select({ action: auditLog.action, data: auditLog.data })
    .from(auditLog)
    .orderBy(asc(auditLog.id));

beforeEach(async () => {
  await resetDb(tdb);
  teacher = { ...(await addUser("teacher")), role: "teacher" };
  other = { ...(await addUser("teacher")), role: "teacher" };
});

describe("createClass / updateClass", () => {
  it("creates the teacher's class and lets only them edit it", async () => {
    const { id } = await createClass(teacher, form, NOW);
    expect(await getTeacherClass(teacher, id)).toMatchObject({
      name: "Vật lý 12A1",
      subject: "physics",
      grade: 12,
      archivedAt: null,
    });
    expect(await getTeacherClass(other, id)).toBeNull();
    expect(
      await updateClass(other, id, { ...form, name: "Lấy lớp" }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(
      await updateClass(teacher, id, { ...form, subject: "math", grade: null }),
    ).toMatchObject({ ok: true });
    expect(await getTeacherClass(teacher, id)).toMatchObject({
      subject: "math",
      grade: null,
    });
    expect((await audit()).map((r) => r.action)).toEqual([
      "class.create",
      "class.update",
    ]);
  });
});

describe("addMembers / removeMember", () => {
  it("adds students by phone and reports the rest, never staff", async () => {
    const { id } = await createClass(teacher, form, NOW);
    const a = await addUser("student");
    const b = await addUser("student");
    const rejected = await addUser("student", { status: "rejected" });
    const staff = await addUser("teacher");
    const typed = [
      a.phone.replace(/^0/, "+84 "),
      b.phone,
      rejected.phone,
      staff.phone,
      "0399999999",
      "không phải số",
    ].join("\n");
    const result = await addMembers(teacher, id, typed, NOW);
    expect(result).toEqual({
      ok: true,
      data: {
        added: 2,
        already: 0,
        notFound: [rejected.phone, staff.phone, "0399999999"],
        invalid: ["không phải số"],
      },
    });
    // Again: already in the class, nothing written twice.
    expect(await addMembers(teacher, id, `${a.phone}, ${b.phone}`)).toEqual({
      ok: true,
      data: { added: 0, already: 2, notFound: [], invalid: [] },
    });
    expect((await getClassMembers(id)).map((m) => m.userId).sort()).toEqual(
      [a.id, b.id].sort(),
    );
    const log = await audit();
    // Ids and counts only: no phone in the audit.
    expect(log.at(-1)).toEqual({
      action: "class.add_members",
      data: { added: 2 },
    });
    expect(JSON.stringify(log)).not.toContain(a.phone);

    expect(await removeMember(other, id, a.id)).toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await removeMember(teacher, id, a.id)).toMatchObject({ ok: true });
    expect(await removeMember(teacher, id, a.id)).toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await getClassMembers(id)).map((m) => m.userId)).toEqual([b.id]);
  });

  it("asks for a phone, caps a batch and refuses another teacher's class", async () => {
    const { id } = await createClass(teacher, form, NOW);
    expect(await addMembers(teacher, id, " \n ")).toMatchObject({
      code: "VALIDATION",
      fieldErrors: { phones: expect.any(String) },
    });
    const many = Array.from(
      { length: 201 },
      (_, i) => `09${String(10_000_000 + i).slice(-8)}`,
    ).join("\n");
    expect(await addMembers(teacher, id, many)).toMatchObject({
      code: "VALIDATION",
    });
    const s = await addUser("student");
    expect(await addMembers(other, id, s.phone)).toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await getClassMembers(id)).toEqual([]);
  });
});

describe("setClassLessons", () => {
  it("gives and takes back the teacher's own published lessons", async () => {
    const { id } = await createClass(teacher, form, NOW);
    const l1 = await addLesson(teacher.id);
    const l2 = await addLesson(teacher.id);
    const draft = await addLesson(teacher.id, "draft");
    const theirs = await addLesson(other.id);
    expect(await setClassLessons(teacher, id, [l1, l2])).toEqual({
      ok: true,
      data: { added: 2, removed: 0 },
    });
    expect(await setClassLessons(teacher, id, [l2])).toEqual({
      ok: true,
      data: { added: 0, removed: 1 },
    });
    expect(await getClassLessonIds(id)).toEqual([l2]);
    for (const bad of [draft, theirs, 999_999])
      expect(await setClassLessons(teacher, id, [l2, bad])).toMatchObject({
        code: "NOT_FOUND",
      });
    expect(await setClassLessons(other, id, [])).toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await getClassLessonIds(id)).toEqual([l2]);
  });
});

describe("archive and delete", () => {
  it("archiving hides the class from students and freezes it; deleting keeps the accounts", async () => {
    const { id } = await createClass(teacher, form, NOW);
    const s = await addUser("student");
    const lessonId = await addLesson(teacher.id);
    await addMembers(teacher, id, s.phone);
    await setClassLessons(teacher, id, [lessonId]);
    expect(await canOpenLesson(s.id, "student", lessonId)).toBe(true);

    expect(await setClassArchived(teacher, id, true, NOW)).toMatchObject({
      ok: true,
    });
    expect(await getStudentClasses(s.id)).toEqual([]);
    expect(await getStudentClass(s.id, id)).toBeNull();
    expect(await canOpenLesson(s.id, "student", lessonId)).toBe(false);
    expect(await addMembers(teacher, id, s.phone)).toMatchObject({
      code: "CONFLICT",
    });
    expect(await setClassLessons(teacher, id, [])).toMatchObject({
      code: "CONFLICT",
    });
    expect(await setClassArchived(teacher, id, false)).toMatchObject({
      ok: true,
    });
    expect(await canOpenLesson(s.id, "student", lessonId)).toBe(true);

    expect(await deleteClass(other, id)).toMatchObject({ code: "NOT_FOUND" });
    expect(await deleteClass(teacher, id)).toEqual({
      ok: true,
      data: { id, members: 1 },
    });
    expect(await tdb.select().from(classes)).toEqual([]);
    expect(await tdb.select().from(classMembers)).toEqual([]);
    expect(await tdb.select().from(classLessons)).toEqual([]);
    const [still] = await tdb.select().from(users).where(eq(users.id, s.id));
    expect(still?.status).toBe("active");
  });
});

describe("class reads", () => {
  it("give students their classes and teachers their counts", async () => {
    const a = await createClass(teacher, { ...form, name: "B lớp" }, NOW);
    const b = await createClass(teacher, { ...form, name: "A lớp" }, NOW);
    const elsewhere = await createClass(other, form, NOW);
    const s = await addUser("student");
    const t = await addUser("student");
    const published = await addLesson(teacher.id);
    const draft = await addLesson(teacher.id, "draft");
    await addMembers(teacher, a.id, `${s.phone}\n${t.phone}`);
    await addMembers(teacher, b.id, s.phone);
    await setClassLessons(teacher, a.id, [published]);
    // A lesson unpublished after it was given stays listed for the teacher,
    // not counted for students.
    await tdb.insert(classLessons).values({ classId: a.id, lessonId: draft });

    const mine = await getStudentClasses(s.id);
    expect(mine.map((c) => [c.name, c.lessons])).toEqual([
      ["A lớp", 0],
      ["B lớp", 1],
    ]);
    const [owner] = await tdb
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, teacher.id));
    expect(mine[0]?.teacherName).toBe(owner?.fullName);
    expect(await getStudentClass(s.id, elsewhere.id)).toBeNull();
    expect(await getStudentClass(t.id, b.id)).toBeNull();

    const rows = await getTeacherClasses(teacher);
    expect(rows.map((c) => [c.name, c.members, c.lessons])).toEqual([
      ["A lớp", 1, 0],
      ["B lớp", 2, 2],
    ]);
    expect(await getTeacherClasses(other)).toHaveLength(1);
    expect(await countTeacherStudents(teacher)).toBe(2);
    expect(await countTeacherStudents(other)).toBe(0);
  });

  it("let a teacher open their own lessons only, and an admin any", async () => {
    const lessonId = await addLesson(teacher.id, "draft");
    expect(await canOpenLesson(teacher.id, "teacher", lessonId)).toBe(true);
    expect(await canOpenLesson(other.id, "teacher", lessonId)).toBe(false);
    expect(await canOpenLesson(other.id, "admin", lessonId)).toBe(true);
    expect(await canOpenLesson(other.id, "admin", 999_999)).toBe(false);
  });

  it("let an admin manage every teacher's class", async () => {
    const { id } = await createClass(teacher, form, NOW);
    const admin: Staff = { ...(await addUser("admin")), role: "admin" };
    const rows = await getTeacherClasses(admin);
    expect(rows.map((r) => [r.id, r.ownerId])).toEqual([[id, teacher.id]]);
    expect(await getTeacherClass(admin, id)).toMatchObject({ id });
    expect(
      await updateClass(admin, id, { ...form, name: "Đổi tên" }),
    ).toMatchObject({ ok: true });
    // …and give it any published lesson.
    const lessonId = await addLesson(other.id);
    expect(await setClassLessons(admin, id, [lessonId])).toMatchObject({
      ok: true,
    });
  });
});
