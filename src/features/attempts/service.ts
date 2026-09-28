import "server-only";
import { randomInt } from "node:crypto";
import { and, count, eq, gte, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { attempts, lessons } from "@/db/schema";
import { toCents } from "@/features/grading/domain/points";
import { getLessonWithAnswers } from "@/features/lessons/queries";
import { LessonConfigSchema } from "@/features/lessons/schema";
import type { ErrorCode } from "@/lib/messages";
import { rateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";
import { buildItems } from "./domain/build-items";
import { createRng } from "./domain/random";
import type { SaveProgressInput } from "./schemas";

/** 06 §4. Tune here only; the integration tests read these values. */
export const ATTEMPT_LIMITS = {
  startPerUser: [10, "1m"],
} as const;

export type AttemptActor = { id: string; role: "student" | "admin" };

/** Who is starting, where from, and when (injectable for tests). */
export type StartContext = {
  ip: string | null;
  now?: Date;
  /** 32-bit seed for pool selection and shuffles; random by default. */
  seed?: number;
};

/**
 * Starts a test on a lesson's published version, or returns the student's
 * attempt already in progress (02 §4.1). One open attempt per lesson is
 * guaranteed by a unique partial index, so parallel starts converge.
 */
export async function startAttempt(
  user: AttemptActor,
  lessonId: number,
  { ip, now = new Date(), seed = randomInt(0, 2 ** 32) }: StartContext,
): Promise<Result<{ attemptId: string; resumed: boolean }>> {
  const limit = await rateLimit(
    `attempt:start:${user.id}`,
    ...ATTEMPT_LIMITS.startPerUser,
    now,
  );
  if (!limit.ok) return err("RATE_LIMITED");

  const [lesson] = await db
    .select({
      status: lessons.status,
      versionId: lessons.currentVersionId,
      config: lessons.config,
    })
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  // Admins may try unpublished lessons that have a version (06 §2).
  if (
    !lesson?.versionId ||
    (lesson.status !== "published" && user.role !== "admin")
  )
    return err("NOT_FOUND");

  const open = await findOpenAttempt(user.id, lessonId);
  if (open) return ok({ attemptId: open, resumed: true });

  const config = LessonConfigSchema.safeParse(lesson.config);
  if (!config.success) return err("INTERNAL");
  const { maxAttempts, timeLimitSec } = config.data;

  if (maxAttempts !== null && user.role !== "admin") {
    const [used] = await db
      .select({ n: count() })
      .from(attempts)
      .where(
        and(
          eq(attempts.userId, user.id),
          eq(attempts.lessonId, lessonId),
          ne(attempts.status, "in_progress"),
        ),
      );
    if ((used?.n ?? 0) >= maxAttempts) return err("ATTEMPT_LIMIT");
  }

  const questions = await getLessonWithAnswers(lessonId, lesson.versionId);
  const items = questions
    ? buildItems(questions, config.data, createRng(seed))
    : [];
  if (items.length === 0) return err("NOT_FOUND");

  const [created] = await db
    .insert(attempts)
    .values({
      userId: user.id,
      lessonId,
      lessonVersionId: lesson.versionId,
      mode: "test",
      items,
      answers: items.map(() => null),
      maxScore: items.reduce((s, i) => s + toCents(i.p), 0) / 100,
      startedAt: now,
      deadlineAt: timeLimitSec
        ? new Date(now.getTime() + timeLimitSec * 1000)
        : null,
      ip,
    })
    // Lost a race with a parallel start: the other one wins.
    .onConflictDoNothing()
    .returning({ id: attempts.id });
  if (created) return ok({ attemptId: created.id, resumed: false });

  const winner = await findOpenAttempt(user.id, lessonId);
  return winner ? ok({ attemptId: winner, resumed: true }) : err("CONFLICT");
}

/** 02 §4.1: the server accepts saves and submits until deadline + 30 s. */
export const DEADLINE_GRACE_MS = 30_000;

/**
 * Autosave (05 §3): one guarded UPDATE on the hot path. Only when that
 * matches nothing does a second read explain why.
 */
export async function saveProgress(
  userId: string,
  attemptId: string,
  input: SaveProgressInput,
  now = new Date(),
): Promise<Result<{ savedAt: string }>> {
  const graceCutoff = new Date(now.getTime() - DEADLINE_GRACE_MS);
  const [saved] = await db
    .update(attempts)
    .set({
      answers: input.answers,
      flagged: cleanFlags(input.flagged, input.answers.length),
      lastSavedAt: now,
    })
    .where(
      and(
        eq(attempts.id, attemptId),
        eq(attempts.userId, userId),
        eq(attempts.status, "in_progress"),
        or(isNull(attempts.deadlineAt), gte(attempts.deadlineAt, graceCutoff)),
        sql`jsonb_array_length(${attempts.items}) = ${input.answers.length}`,
      ),
    )
    .returning({ id: attempts.id });
  if (saved) return ok({ savedAt: now.toISOString() });
  return err(await whyNotWritable(userId, attemptId, input, graceCutoff));
}

/** Unique item indexes inside the test, ascending. */
const cleanFlags = (flags: number[], count: number) =>
  [...new Set(flags.filter((i) => i < count))].sort((a, b) => a - b);

async function whyNotWritable(
  userId: string,
  attemptId: string,
  input: { answers: unknown[] },
  graceCutoff: Date,
): Promise<ErrorCode> {
  const [row] = await db
    .select({
      userId: attempts.userId,
      status: attempts.status,
      deadlineAt: attempts.deadlineAt,
      count: sql<number>`jsonb_array_length(${attempts.items})`,
    })
    .from(attempts)
    .where(eq(attempts.id, attemptId))
    .limit(1);
  // Someone else's attempt looks the same as a missing one.
  if (!row || row.userId !== userId) return "NOT_FOUND";
  if (row.status !== "in_progress") return "ATTEMPT_CLOSED";
  if (row.deadlineAt && row.deadlineAt < graceCutoff) return "DEADLINE_PASSED";
  if (Number(row.count) !== input.answers.length) return "VALIDATION";
  return "CONFLICT";
}

async function findOpenAttempt(userId: string, lessonId: number) {
  const [row] = await db
    .select({ id: attempts.id })
    .from(attempts)
    .where(
      and(
        eq(attempts.userId, userId),
        eq(attempts.lessonId, lessonId),
        eq(attempts.status, "in_progress"),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}
