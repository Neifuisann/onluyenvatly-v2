import "server-only";
import { randomInt } from "node:crypto";
import { and, count, eq, gte, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { attempts, lessons } from "@/db/schema";
import { grade } from "@/features/grading/domain/grade";
import { toCents } from "@/features/grading/domain/points";
import { getLessonWithAnswers } from "@/features/lessons/queries";
import { LessonConfigSchema } from "@/features/lessons/schema";
import { rateAttempt } from "@/features/rating/service";
import { mistakeChanges } from "@/features/review/domain/mistakes";
import { recordMistakes } from "@/features/review/service";
import type { ErrorCode } from "@/lib/messages";
import { rateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";
import { buildItems, questionsForItems } from "./domain/build-items";
import {
  DEADLINE_GRACE_MS,
  isPastGrace,
  timeTakenSec,
} from "./domain/deadline";
import { createRng } from "./domain/random";
import type { SaveProgressInput, SubmitAttemptInput } from "./schemas";

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

export { DEADLINE_GRACE_MS };

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

export type SubmitOutcome = {
  attemptId: string;
  score: number;
  maxScore: number;
  score10: number;
  /** A retry or a parallel submit found the attempt already graded. */
  alreadySubmitted: boolean;
  /** Arrived after deadline + grace: graded with the last saved answers. */
  late: boolean;
};

/**
 * Submit, grade, rate and update the mistakes bank (ADR-004, 02 §4.1) in
 * one transaction. The row lock plus
 * the status check make double clicks, retries and parallel submits return
 * the same graded result.
 */
export async function submitAttempt(
  userId: string,
  attemptId: string,
  input: SubmitAttemptInput,
  now = new Date(),
): Promise<Result<SubmitOutcome>> {
  // Read outside the transaction: the lesson content comes from the shared
  // cache, so a burst of submits reads it once, and no pooled connection is
  // held while it loads.
  const [pre] = await db
    .select({
      userId: attempts.userId,
      lessonId: attempts.lessonId,
      lessonVersionId: attempts.lessonVersionId,
      config: lessons.config,
    })
    .from(attempts)
    .leftJoin(lessons, eq(lessons.id, attempts.lessonId))
    .where(eq(attempts.id, attemptId))
    .limit(1);
  if (!pre || pre.userId !== userId) return err("NOT_FOUND");
  // Single-lesson tests; review attempts (items with their own `v`) arrive in S7-06.
  if (!pre.lessonId || !pre.lessonVersionId) return err("INTERNAL");
  const { lessonId, lessonVersionId } = pre;
  const questions = await getLessonWithAnswers(lessonId, lessonVersionId);
  if (!questions) return err("INTERNAL");
  const byId = new Map(questions.map((q) => [q.id, q]));
  const config = LessonConfigSchema.safeParse(pre.config);
  const {
    tfScoring = "thpt2025",
    countsForRating = true,
    timeLimitSec = null,
  } = config.success ? config.data : {};

  return db.transaction(async (tx) => {
    const [a] = await tx
      .select({
        status: attempts.status,
        items: attempts.items,
        answers: attempts.answers,
        flagged: attempts.flagged,
        score: attempts.score,
        maxScore: attempts.maxScore,
        score10: attempts.score10,
        startedAt: attempts.startedAt,
        deadlineAt: attempts.deadlineAt,
      })
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .for("update")
      .limit(1);
    if (!a) return err("NOT_FOUND");
    if (a.status !== "in_progress")
      return ok({
        attemptId,
        score: a.score ?? 0,
        maxScore: a.maxScore,
        score10: a.score10 ?? 0,
        alreadySubmitted: true,
        late: false,
      });

    const late = isPastGrace(a.deadlineAt, now);
    if (!late && input.answers.length !== a.items.length)
      return err("VALIDATION");

    const answers = late ? a.answers : input.answers;
    const flagged = late
      ? a.flagged
      : cleanFlags(input.flagged, a.items.length);
    const result = grade(
      questionsForItems(a.items, byId),
      a.items,
      answers,
      tfScoring,
    );
    const taken = timeTakenSec(a.startedAt, a.deadlineAt, now);
    await tx
      .update(attempts)
      .set({
        status: "submitted",
        answers,
        flagged,
        earned: result.earned,
        score: result.score,
        maxScore: result.maxScore,
        score10: result.score10,
        submittedAt: now,
        timeTakenSec: taken,
        clientSubmitId: input.clientSubmitId,
      })
      .where(eq(attempts.id, attemptId));
    // Denormalized for "Nhiều lượt làm"; the catalog picks it up when its
    // cache refreshes (no per-submit invalidation, 08).
    await tx
      .update(lessons)
      .set({ attemptCount: sql`${lessons.attemptCount} + 1` })
      .where(eq(lessons.id, lessonId));
    if (countsForRating)
      await rateAttempt(tx, {
        userId,
        attemptId,
        lessonId,
        score: result.score,
        maxScore: result.maxScore,
        timeTakenSec: taken,
        timeLimitSec,
        now,
      });
    await recordMistakes(tx, {
      userId,
      lessonId,
      lessonVersionId,
      attemptId,
      ...mistakeChanges(
        a.items,
        result.marks.map((m) => m.outcome),
      ),
      now,
    });
    return ok({
      attemptId,
      score: result.score,
      maxScore: result.maxScore,
      score10: result.score10,
      alreadySubmitted: false,
      late,
    });
  });
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
