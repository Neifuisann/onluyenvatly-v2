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
import { and, eq, inArray, like, ne, or } from "drizzle-orm";
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
import { e2eLessons, e2eQuestions } from "../tests/e2e/fixtures/lessons.ts";
import { e2eResultAttempts } from "../tests/e2e/fixtures/results.ts";
import {
  CREATED_ADMIN_PREFIX,
  E2E_PASSWORD,
  e2eAdmin,
  e2eRatings,
  e2eSpecAdminUsernames,
  e2eStudents,
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
) {
  const passwordHash = password ? await hashPassword(password) : null;
  const [row] = await db
    .insert(users)
    .values({
      role: "admin",
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
        role: "admin",
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
  await upsertAdmin(e2eAdmin.username, e2eAdmin.fullName, E2E_PASSWORD);
  for (const username of e2eSpecAdminUsernames)
    await upsertAdmin(username, e2eAdmin.fullName, E2E_PASSWORD);
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
    await db.transaction(async (tx) => {
      const values = {
        ...lesson,
        ...summarizeLesson(questions, LessonConfigSchema.parse(lesson.config)),
        publishedAt: new Date("2026-01-01"),
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
  // Every run starts without attempts (in-progress ones would be resumed).
  await db.delete(schema.attempts);
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
  // Tests assume the defaults.
  await db
    .update(settings)
    .set({ registrationOpen: true, singleSession: false, announcement: null });
  console.log(
    `e2e profile: ${1 + e2eSpecAdminUsernames.length} admins, ${e2eStudents.length} students.`,
  );
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

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
