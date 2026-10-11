/**
 * S1-07: seed a database. Idempotent (upserts), safe to re-run.
 *
 *   pnpm seed                 # dev: settings row + first admin
 *   pnpm seed --profile e2e   # test accounts from tests/e2e/fixtures/users.ts
 *
 * Dev admin: SEED_ADMIN_USERNAME (default "admin") / SEED_ADMIN_PASSWORD. If
 * the password is empty a random one is generated and printed once. Existing
 * admins keep their password unless SEED_ADMIN_PASSWORD is set.
 *
 * Runs with Node's type stripping, so it imports src files by relative path.
 */
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { and, eq, inArray, isNull, like, ne, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema.ts";
import {
  hashPassword,
  passwordIssue,
} from "../src/features/auth/core/password.ts";
import { serializeLesson } from "../src/features/lessons/domain/serializer.ts";
import { summarizeLesson } from "../src/features/lessons/domain/summary.ts";
import { LessonConfigSchema } from "../src/features/lessons/schema.ts";
import {
  applyRating,
  INITIAL_RATING,
  performance,
  timeBonusV2,
} from "../src/features/rating/domain/rating.ts";
import {
  COMPOSED_TITLE_PREFIX,
  e2eLessons,
  e2eQuestions,
  flaggedExplanations,
  IMPORTED_TITLE_PREFIX,
  TEACHER_LESSON_PREFIX,
} from "../tests/e2e/fixtures/lessons.ts";
import { e2eResultAttempts } from "../tests/e2e/fixtures/results.ts";
import {
  STATS_LESSON,
  statsAttempts,
  statsQuestionsV2,
  statsStudents,
} from "../tests/e2e/fixtures/stats.ts";
import {
  CREATED_ADMIN_PREFIX,
  CREATED_CLASS_PREFIX,
  E2E_CLASS_11_NAME,
  E2E_CLASS_NAME,
  E2E_PASSWORD,
  e2eAdmin,
  e2eRatings,
  e2eSpecAdminUsernames,
  e2eStudent,
  e2eStudents,
  e2eTeacherUsernames,
  REGISTERED_NAME_PREFIX,
} from "../tests/e2e/fixtures/users.ts";

const { values } = parseArgs({
  options: { profile: { type: "string", default: "dev" } },
});
const profile = values.profile;
if (profile !== "dev" && profile !== "e2e") {
  console.error(`Unknown profile "${profile}". Use dev or e2e.`);
  process.exit(1);
}

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL (or DATABASE_URL_DIRECT).");
  process.exit(1);
}
const host = new URL(url).hostname;
const isLocal = ["localhost", "127.0.0.1", "::1", "postgres"].includes(host);
if (profile === "e2e" && !isLocal) {
  console.error(
    `Refusing to write test accounts to a non-local database (${host}).`,
  );
  process.exit(1);
}
if (process.env.VERCEL_ENV === "production") {
  console.error("Refusing to seed with VERCEL_ENV=production.");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
const db = drizzle({ client, schema });
const { users, settings } = schema;

async function upsertAdmin(
  username: string,
  fullName: string,
  password: string | null,
  role: "admin" | "teacher" = "admin",
) {
  const passwordHash = password ? await hashPassword(password) : null;
  const [row] = await db
    .insert(users)
    .values({
      role,
      status: "active",
      username,
      fullName,
      passwordHash:
        passwordHash ??
        (await hashPassword(randomBytes(24).toString("base64url"))),
      approvedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.username,
      set: {
        role,
        status: "active",
        ...(passwordHash && { passwordHash, mustChangePassword: false }),
        updatedAt: new Date(),
      },
    })
    .returning({
      id: users.id,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });
  return row;
}

async function main() {
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();

  if (profile === "dev") {
    const username = (process.env.SEED_ADMIN_USERNAME || "admin").toLowerCase();
    let password = process.env.SEED_ADMIN_PASSWORD || null;
    const existing = await db.query.users.findFirst({
      columns: { id: true },
      where: (u, { eq }) => eq(u.username, username),
    });
    let generated = false;
    if (!password && !existing) {
      password = randomBytes(9).toString("base64url");
      generated = true;
    }
    if (password) {
      const issue = passwordIssue(password);
      if (issue) throw new Error(`SEED_ADMIN_PASSWORD rejected: ${issue}`);
    }
    await upsertAdmin(username, "Quản trị viên", password);
    console.log(`Admin "${username}" ready.`);
    if (generated)
      console.log(`Generated password (shown once, store it now): ${password}`);
    else if (!password) console.log("Existing password kept.");
    return;
  }

  // e2e: fixed test accounts, passwords reset on every run.
  const owner = await upsertAdmin(
    e2eAdmin.username,
    e2eAdmin.fullName,
    E2E_PASSWORD,
  );
  if (!owner) throw new Error("Admin seed failed");
  for (const username of e2eSpecAdminUsernames)
    await upsertAdmin(username, e2eAdmin.fullName, E2E_PASSWORD);
  // B-03 teachers, each the owner of their project's teacher lesson.
  const teacherIds = new Map<string, string>();
  for (const username of e2eTeacherUsernames) {
    const teacher = await upsertAdmin(
      username,
      `Cô giáo ${username.slice(-1).toUpperCase()}`,
      E2E_PASSWORD,
      "teacher",
    );
    if (!teacher) throw new Error("Teacher seed failed");
    teacherIds.set(username.slice(-1), teacher.id);
  }
  // Admins the settings spec created in earlier runs (S6-03).
  await db
    .delete(users)
    .where(
      and(
        eq(users.role, "admin"),
        like(users.username, `${CREATED_ADMIN_PREFIX}%`),
      ),
    );
  const passwordHash = await hashPassword(E2E_PASSWORD);
  // Students the register specs signed up in earlier runs (they would pile
  // up in the admin pending queue).
  await db
    .delete(users)
    .where(
      and(
        eq(users.role, "student"),
        or(
          like(users.fullName, `${REGISTERED_NAME_PREFIX} %`),
          eq(users.fullName, "Nguyễn Văn Kiểm Thử"),
        ),
      ),
    );
  for (const s of e2eStudents) {
    const [student] = await db
      .insert(users)
      .values({
        role: "student",
        status: s.status,
        phone: s.phone,
        fullName: s.fullName,
        grade: s.grade,
        className: `${s.grade}A1`,
        dateOfBirth: "2008-01-01",
        passwordHash,
      })
      .onConflictDoUpdate({
        target: users.phone,
        set: {
          status: s.status,
          passwordHash,
          mustChangePassword: false,
          // S8-04 settings a spec may have changed.
          fullName: s.fullName,
          className: `${s.grade}A1`,
          leaderboardInitials: false,
          avatarPath: null,
          deletionRequestedAt: null,
          updatedAt: new Date(),
        },
      })
      .returning({ id: users.id });
    if (!student) throw new Error("Student seed failed");
    // Nobody starts logged in or with extra tries (S6 student admin spec).
    await db
      .delete(schema.sessions)
      .where(eq(schema.sessions.userId, student.id));
    await db
      .delete(schema.attemptOverrides)
      .where(eq(schema.attemptOverrides.userId, student.id));
    // Every run starts from the fixture ratings (S4-05 leaderboard).
    await db
      .delete(schema.ratingEvents)
      .where(eq(schema.ratingEvents.userId, student.id));
    await db
      .delete(schema.ratings)
      .where(eq(schema.ratings.userId, student.id));
    const fixture = e2eRatings[s.key];
    if (fixture) {
      const { rating, weekDelta, earlier } = fixture;
      const day = 24 * 60 * 60 * 1000;
      const event = (after: number, delta: number, daysAgo: number) => ({
        userId: student.id,
        before: after - delta,
        delta,
        after,
        formula: "v2",
        createdAt: new Date(Date.now() - daysAgo * day),
      });
      await db.insert(schema.ratings).values({
        userId: student.id,
        rating,
        peak: rating,
        ratedAttempts: earlier === undefined ? 1 : 2,
      });
      await db
        .insert(schema.ratingEvents)
        .values([
          ...(earlier === undefined
            ? []
            : [event(rating - weekDelta, earlier, 10)]),
          event(rating, weekDelta, 1),
        ]);
    }
  }
  // Fresh rate-limit counters so reruns within a minute stay under the limits.
  const seeded: number[] = [];
  for (const { questions = e2eQuestions, ...lesson } of e2eLessons) {
    const lessonOwner = lesson.legacyId?.startsWith(TEACHER_LESSON_PREFIX)
      ? (teacherIds.get(lesson.legacyId.slice(-1)) ?? owner.id)
      : owner.id;
    await db.transaction(async (tx) => {
      const values = {
        ...lesson,
        ...summarizeLesson(questions, LessonConfigSchema.parse(lesson.config)),
        publishedAt: new Date("2026-01-01"),
        // B-03: the e2e admin owns the fixtures, the teachers their own.
        ownerId: lessonOwner,
        createdBy: lessonOwner,
      };
      const [row] = await tx
        .insert(schema.lessons)
        .values(values)
        .onConflictDoUpdate({ target: schema.lessons.legacyId, set: values })
        .returning({ id: schema.lessons.id });
      if (!row) throw new Error("Lesson seed failed");
      seeded.push(row.id);
      const content = { questions, sourceText: serializeLesson(questions) };
      const [version] = await tx
        .insert(schema.lessonVersions)
        .values({ lessonId: row.id, version: 1, ...content })
        .onConflictDoUpdate({
          target: [
            schema.lessonVersions.lessonId,
            schema.lessonVersions.version,
          ],
          set: content,
        })
        .returning({ id: schema.lessonVersions.id });
      if (!version) throw new Error("Version seed failed");
      await tx
        .update(schema.lessons)
        .set({
          currentVersionId: lesson.status === "published" ? version.id : null,
          draftVersionId: lesson.status === "draft" ? version.id : null,
        })
        .where(eq(schema.lessons.id, row.id));
    });
  }
  await db.delete(schema.rateLimits);
  // AI explanations (S7-02) are generated by the specs: start without any,
  // except the flagged ones of the 👎 queue (S7-03).
  await db.delete(schema.questionExplanations);
  for (const { legacyId, ...flagged } of flaggedExplanations) {
    const [lesson] = await db
      .select({ id: schema.lessons.id })
      .from(schema.lessons)
      .where(eq(schema.lessons.legacyId, legacyId));
    await db
      .insert(schema.questionExplanations)
      .values({ ...flagged, lessonId: lesson?.id ?? null });
  }
  // Every run starts without attempts (in-progress ones would be resumed)
  // or mistakes (S7-06: they also pin the versions deleted below).
  await db.delete(schema.mistakes);
  await db.delete(schema.attempts);
  // …and without game rooms (B-05): an open room would keep its PIN.
  await db.delete(schema.gameRooms);
  // Drafts the AI import (S7-04) and compose (S5-07) specs created.
  await db
    .delete(schema.lessons)
    .where(
      and(
        isNull(schema.lessons.legacyId),
        or(
          like(schema.lessons.title, `${IMPORTED_TITLE_PREFIX}%`),
          like(schema.lessons.title, `${COMPOSED_TITLE_PREFIX}%`),
        ),
      ),
    );
  await seedResults();
  // Versions a publish spec added (S5-04); the fixture is version 1.
  await db
    .delete(schema.lessonVersions)
    .where(
      and(
        inArray(schema.lessonVersions.lessonId, seeded),
        ne(schema.lessonVersions.version, 1),
      ),
    );
  await seedStats(passwordHash);
  await seedClass(owner.id);
  // Tests assume the defaults.
  await db.update(settings).set({
    registrationOpen: true,
    singleSession: false,
    aiEnabled: true,
    aiDailyBudget: 200,
    announcement: null,
  });
  console.log(
    `e2e profile: ${1 + e2eSpecAdminUsernames.length} admins, ${e2eTeacherUsernames.length} teachers, ${e2eStudents.length} students.`,
  );
}

/**
 * B-03: students reach lessons through a class. One class of the e2e admin
 * holds every seeded student and every lesson not deleted, so the student
 * specs see the fixture catalog as before. Classes a class spec made in an
 * earlier run go (their names carry the spec prefix).
 */
async function seedClass(ownerId: string) {
  await db
    .delete(schema.classes)
    .where(like(schema.classes.name, `${CREATED_CLASS_PREFIX}%`));
  const upsertClass = async (name: string) => {
    const existing = await db.query.classes.findFirst({
      columns: { id: true },
      where: (c, { and, eq }) => and(eq(c.ownerId, ownerId), eq(c.name, name)),
    });
    const id =
      existing?.id ??
      (
        await db
          .insert(schema.classes)
          .values({ ownerId, name })
          .returning({ id: schema.classes.id })
      )[0]?.id;
    if (!id) throw new Error("Class seed failed");
    await db
      .update(schema.classes)
      .set({ archivedAt: null })
      .where(eq(schema.classes.id, id));
    return id;
  };
  const classId = await upsertClass(E2E_CLASS_NAME);
  const class11 = await upsertClass(E2E_CLASS_11_NAME);
  await db
    .delete(schema.classMembers)
    .where(eq(schema.classMembers.classId, class11));
  const eleven = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.role, "student"),
        or(eq(users.grade, 11), eq(users.phone, e2eStudent("active").phone)),
      ),
    );
  if (eleven.length)
    await db
      .insert(schema.classMembers)
      .values(eleven.map((s) => ({ classId: class11, userId: s.id })));
  const students = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "student"));
  if (students.length)
    await db
      .insert(schema.classMembers)
      .values(students.map((s) => ({ classId, userId: s.id })))
      .onConflictDoNothing();
  // The admin's lessons only: the teachers' stay theirs (B-03).
  const lessons = await db
    .select({ id: schema.lessons.id })
    .from(schema.lessons)
    .where(
      and(
        isNull(schema.lessons.deletedAt),
        eq(schema.lessons.ownerId, ownerId),
      ),
    );
  if (lessons.length)
    await db
      .insert(schema.classLessons)
      .values(lessons.map((l) => ({ classId, lessonId: l.id })))
      .onConflictDoNothing();
}

/**
 * S6-04 results spec: each results student gets the submitted attempts of
 * fixtures/results.ts (oldest first, the first with exam-guard events), rated
 * with the real v2 formula, so deleting one replays a real history.
 */
async function seedResults() {
  const versions = await db
    .select({
      legacyId: schema.lessons.legacyId,
      lessonId: schema.lessons.id,
      versionId: schema.lessonVersions.id,
    })
    .from(schema.lessons)
    .innerJoin(
      schema.lessonVersions,
      and(
        eq(schema.lessonVersions.lessonId, schema.lessons.id),
        eq(schema.lessonVersions.version, 1),
      ),
    )
    .where(inArray(schema.lessons.legacyId, ["e2e-runner", "e2e-timer"]));
  const hour = 60 * 60 * 1000;
  for (const key of ["results", "results2"] as const) {
    const phone = e2eStudents.find((s) => s.key === key)?.phone ?? "";
    const student = await db.query.users.findFirst({
      columns: { id: true },
      where: (u, { eq }) => eq(u.phone, phone),
    });
    if (!student) throw new Error(`No ${key} student`);
    let state = INITIAL_RATING;
    for (const a of e2eResultAttempts) {
      const lesson = versions.find((v) => v.legacyId === a.lesson);
      if (!lesson) throw new Error(`No ${a.lesson} lesson`);
      const submittedAt = new Date(Date.now() - a.hoursAgo * hour);
      const maxScore = a.items.reduce((s, i) => s + i.p, 0);
      const score = a.earned.reduce((s, e) => s + e, 0);
      const [attempt] = await db
        .insert(schema.attempts)
        .values({
          userId: student.id,
          lessonId: lesson.lessonId,
          lessonVersionId: lesson.versionId,
          status: "submitted",
          items: a.items,
          answers: a.answers,
          guardEvents: a.guardEvents,
          earned: a.earned,
          score,
          maxScore,
          score10: Math.round((score / maxScore) * 1000) / 100,
          startedAt: new Date(submittedAt.getTime() - a.timeTakenSec * 1000),
          submittedAt,
          timeTakenSec: a.timeTakenSec,
        })
        .returning({ id: schema.attempts.id });
      if (!attempt) throw new Error("Attempt seed failed");
      const perf = performance(score, maxScore);
      const bonus = timeBonusV2(a.timeTakenSec, a.timeLimitSec);
      const step = applyRating(state, perf, bonus);
      state = step.state;
      await db.insert(schema.ratingEvents).values({
        userId: student.id,
        attemptId: attempt.id,
        lessonId: lesson.lessonId,
        before: step.before,
        delta: step.delta,
        after: step.after,
        performance: perf,
        timeBonus: bonus,
        formula: "v2",
        createdAt: submittedAt,
      });
    }
    await db.insert(schema.ratings).values({
      userId: student.id,
      rating: state.rating,
      peak: state.peak,
      ratedAttempts: state.rated,
    });
  }
}

/**
 * S6-05 statistics spec: the archived stats lesson gets a current version 2
 * and the hand-computed attempts of fixtures/stats.ts from five students of
 * its own (grade 10, unrated). Runs after the stray-version cleanup.
 */
async function seedStats(passwordHash: string) {
  const lesson = await db.query.lessons.findFirst({
    columns: { id: true, config: true },
    where: (l, { eq }) => eq(l.legacyId, STATS_LESSON.legacyId),
  });
  if (!lesson) throw new Error("No stats lesson");
  const versions = new Map<number, number>();
  const [v1] = await db
    .select({ id: schema.lessonVersions.id })
    .from(schema.lessonVersions)
    .where(
      and(
        eq(schema.lessonVersions.lessonId, lesson.id),
        eq(schema.lessonVersions.version, 1),
      ),
    );
  if (!v1) throw new Error("No stats version 1");
  versions.set(1, v1.id);
  const content = {
    questions: statsQuestionsV2,
    sourceText: serializeLesson(statsQuestionsV2),
  };
  const [v2] = await db
    .insert(schema.lessonVersions)
    .values({ lessonId: lesson.id, version: 2, ...content })
    .returning({ id: schema.lessonVersions.id });
  if (!v2) throw new Error("Stats version seed failed");
  versions.set(2, v2.id);
  await db
    .update(schema.lessons)
    .set({
      currentVersionId: v2.id,
      draftVersionId: null,
      attemptCount: statsAttempts.length,
      ...summarizeLesson(
        statsQuestionsV2,
        LessonConfigSchema.parse(lesson.config),
      ),
    })
    .where(eq(schema.lessons.id, lesson.id));
  const ids: string[] = [];
  for (const s of statsStudents) {
    const [student] = await db
      .insert(users)
      .values({
        role: "student",
        status: "active",
        phone: s.phone,
        fullName: s.fullName,
        grade: 10,
        className: "10A2",
        dateOfBirth: "2008-01-01",
        passwordHash,
      })
      .onConflictDoUpdate({
        target: users.phone,
        set: { status: "active", fullName: s.fullName, updatedAt: new Date() },
      })
      .returning({ id: users.id });
    if (!student) throw new Error("Stats student seed failed");
    ids.push(student.id);
  }
  const hour = 60 * 60 * 1000;
  await db.insert(schema.attempts).values(
    statsAttempts.map((a) => {
      const submittedAt = new Date(Date.now() - a.hoursAgo * hour);
      return {
        userId: ids[a.student] ?? "",
        lessonId: lesson.id,
        lessonVersionId: versions.get(a.version) ?? 0,
        status: "submitted" as const,
        items: a.items,
        answers: a.answers,
        earned: a.earned,
        score: a.earned.reduce((sum, e) => sum + e, 0),
        maxScore: a.items.reduce((sum, i) => sum + i.p, 0),
        score10: a.score10,
        startedAt: new Date(submittedAt.getTime() - 600_000),
        submittedAt,
        timeTakenSec: 600,
      };
    }),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    // Drizzle wraps driver errors; the real reason (missing table, network) is the cause.
    if (error instanceof Error && error.cause instanceof Error)
      console.error(`Cause: ${error.cause.message}`);
    process.exitCode = 1;
  })
  .finally(() => client.end());
