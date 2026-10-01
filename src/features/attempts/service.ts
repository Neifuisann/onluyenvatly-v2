import "server-only";
import { randomInt } from "node:crypto";
import { and, eq, gte, isNull, or, type SQL, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  attemptOverrides,
  attempts,
  type GuardEvent,
  lessons,
} from "@/db/schema";
import { grade } from "@/features/grading/domain/grade";
import { toCents } from "@/features/grading/domain/points";
import {
  getFreshLessonForStarting,
  getLessonForStarting,
  getLessonWithAnswers,
} from "@/features/lessons/queries";
import {
  type LessonConfig,
  LessonConfigSchema,
} from "@/features/lessons/schema";
import { rateAttempt } from "@/features/rating/service";
import { mistakeChanges } from "@/features/review/domain/mistakes";
import {
  addChecked,
  lockChecked,
  type PracticeFeedback,
  practiceFeedback,
  REVIEW_TF_SCORING,
} from "@/features/review/domain/practice";
import { type MistakeTarget, recordMistakes } from "@/features/review/service";
import type { ErrorCode } from "@/lib/messages";
import { FOREIGN_KEY_VIOLATION, pgErrorCode } from "@/lib/pg-error";
import { rateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";
import { itemQuestions, itemSources } from "./content";
import { recordAttemptCount } from "./counter-service";
import { buildItems } from "./domain/build-items";
import {
  DEADLINE_GRACE_MS,
  isPastGrace,
  timeTakenSec,
} from "./domain/deadline";
import { MAX_GUARD_EVENTS } from "./domain/guard";
import { createRng } from "./domain/random";
import {
  attemptDeadline,
  canStart,
  revealAt,
  type StartCounts,
} from "./domain/schedule";
import type {
  CheckPracticeInput,
  SaveProgressInput,
  SubmitAttemptInput,
} from "./schemas";

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
  const ctx = { ip, now, seed };
  try {
    return await startOnce(user, lessonId, ctx);
  } catch (error) {
    // A publish deleted the version between our read and the insert (S5-04
    // retires unused versions): start again on the new one.
    if (pgErrorCode(error) !== FOREIGN_KEY_VIOLATION) throw error;
    return startOnce(user, lessonId, ctx, true);
  }
}

async function startOnce(
  user: AttemptActor,
  lessonId: number,
  { ip, now, seed }: Required<StartContext>,
  fresh = false,
): Promise<Result<{ attemptId: string; resumed: boolean }>> {
  const lesson = await (fresh
    ? getFreshLessonForStarting(lessonId)
    : getLessonForStarting(lessonId));
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

  if (user.role !== "admin") {
    const check = canStart(
      config.data,
      await startCounts(user.id, lessonId, config.data),
      now,
      false,
    );
    if (!check.ok) return err(check.code);
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
      deadlineAt: attemptDeadline(config.data, now),
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
      answers: keepChecked(input.answers),
      flagged: cleanFlags(input.flagged, input.answers.length),
      ...appendGuard(input.guardEvents),
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
      mode: attempts.mode,
      items: attempts.items,
      config: lessons.config,
    })
    .from(attempts)
    .leftJoin(lessons, eq(lessons.id, attempts.lessonId))
    .where(eq(attempts.id, attemptId))
    .limit(1);
  if (!pre || pre.userId !== userId) return err("NOT_FOUND");
  // Items are fixed at start, so their questions load before the lock.
  // A review attempt's items come from several lessons (S7-06).
  const sources = await itemSources(pre);
  const questions = sources && (await itemQuestions(pre, sources));
  if (!sources || !questions) return err("INTERNAL");
  const { lessonId } = pre;
  const config = LessonConfigSchema.safeParse(pre.config);
  const {
    tfScoring = REVIEW_TF_SCORING,
    countsForRating = true,
    timeLimitSec = null,
  } = config.success ? config.data : {};
  // Practice and review never move the rating (01 Q9).
  const rated = pre.mode === "test" && lessonId !== null && countsForRating;

  const outcome = await db.transaction(async (tx) => {
    const [a] = await tx
      .select({
        status: attempts.status,
        items: attempts.items,
        answers: attempts.answers,
        flagged: attempts.flagged,
        checked: attempts.checked,
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

    const answers = late
      ? a.answers
      : lockChecked(input.answers, a.answers, a.checked);
    const flagged = late
      ? a.flagged
      : cleanFlags(input.flagged, a.items.length);
    const result = grade(questions, a.items, answers, tfScoring);
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
        ...appendGuard(input.guardEvents),
      })
      .where(eq(attempts.id, attemptId));
    if (rated)
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
    // Keyed by lesson and question: a review attempt spans lessons.
    const targets = new Map<string, MistakeTarget>();
    const keys = a.items.map((item, i) => {
      const source = sources[i] as (typeof sources)[number];
      const key = `${source.lessonId}:${item.q}`;
      targets.set(key, {
        lessonId: source.lessonId,
        lessonVersionId: source.versionId,
        questionId: item.q,
        questionType: (questions[i] as (typeof questions)[number]).type,
      });
      return { q: key };
    });
    const changes = mistakeChanges(
      keys,
      result.marks.map((m) => m.outcome),
    );
    const toTargets = (ks: string[]) => ks.flatMap((k) => targets.get(k) ?? []);
    await recordMistakes(tx, {
      userId,
      attemptId,
      wrong: toTargets(changes.wrong),
      correct: toTargets(changes.correct),
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
  // The grade has committed: a lost counter write must not fail the submit.
  // The daily flush (`flushAttemptCounters`) repairs it.
  if (outcome.ok && lessonId !== null)
    await recordAttemptCount(attemptId).catch((error: unknown) => {
      console.error(
        "submit: counter deferred:",
        pgErrorCode(error) ?? "unknown",
      );
    });
  return outcome;
}

/**
 * Appends new exam-guard events, keeping the first `MAX_GUARD_EVENTS`.
 * Append-only: a forged save can't erase what was recorded. A beacon that
 * arrived but wasn't confirmed may repeat a few events; teachers read them
 * as a timeline, so that is harmless.
 */
function appendGuard(events: readonly GuardEvent[] | undefined): {
  guardEvents?: SQL;
} {
  if (!events?.length) return {};
  return {
    guardEvents: sql`(
      select coalesce(jsonb_agg(e order by n), '[]'::jsonb)
      from (
        select e, n
        from jsonb_array_elements(${attempts.guardEvents} || ${JSON.stringify(events)}::jsonb)
          with ordinality as x(e, n)
        order by n
        limit ${MAX_GUARD_EVENTS}
      ) kept
    )`,
  };
}

/**
 * The saved answers, except that checked practice answers (S7-06) keep their
 * stored value: once the key was shown, a save can't change them.
 */
function keepChecked(answers: SaveProgressInput["answers"]): SQL {
  const json = JSON.stringify(answers);
  return sql`case when cardinality(${attempts.checked}) = 0 then ${json}::jsonb
    else (
      select coalesce(jsonb_agg(
        case when (x.n - 1) = any(${attempts.checked})
          then ${attempts.answers} -> (x.n::int - 1) else x.e end
        order by x.n), '[]'::jsonb)
      from jsonb_array_elements(${json}::jsonb) with ordinality as x(e, n)
    ) end`;
}

/**
 * "Kiểm tra" in a practice or review attempt (05 `checkPracticeAnswer`,
 * S7-06): grades one item, returns its key and locks the answer. Asking
 * again for a checked item returns the feedback for the stored answer.
 * Tests never get feedback before submit (ADR-004).
 */
export async function checkPracticeAnswer(
  userId: string,
  input: CheckPracticeInput,
): Promise<Result<PracticeFeedback>> {
  const [pre] = await db
    .select({
      userId: attempts.userId,
      mode: attempts.mode,
      status: attempts.status,
      lessonId: attempts.lessonId,
      lessonVersionId: attempts.lessonVersionId,
      items: attempts.items,
    })
    .from(attempts)
    .where(eq(attempts.id, input.attemptId))
    .limit(1);
  if (!pre || pre.userId !== userId) return err("NOT_FOUND");
  if (pre.mode === "test") return err("FORBIDDEN");
  if (pre.status !== "in_progress") return err("ATTEMPT_CLOSED");
  const item = pre.items[input.index];
  if (!item) return err("VALIDATION");
  const [question] = (await itemQuestions({ ...pre, items: [item] })) ?? [];
  if (!question) return err("INTERNAL");

  return db.transaction(async (tx) => {
    const [a] = await tx
      .select({
        status: attempts.status,
        answers: attempts.answers,
        checked: attempts.checked,
      })
      .from(attempts)
      .where(eq(attempts.id, input.attemptId))
      .for("update")
      .limit(1);
    if (!a || a.status !== "in_progress") return err("ATTEMPT_CLOSED");
    if (a.checked.includes(input.index))
      return ok(
        practiceFeedback(question, item, a.answers[input.index] ?? null),
      );
    await tx
      .update(attempts)
      .set({
        answers: sql`jsonb_set(${attempts.answers}, ${`{${input.index}}`}::text[], ${JSON.stringify(input.answer)}::jsonb)`,
        checked: addChecked(a.checked, input.index),
      })
      .where(eq(attempts.id, input.attemptId));
    return ok(practiceFeedback(question, item, input.answer));
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

/**
 * What `canStart` needs, in one query, and only when the lesson has a limit
 * or has closed: finished attempts, attempts since the close, extra tries.
 */
async function startCounts(
  userId: string,
  lessonId: number,
  config: LessonConfig,
): Promise<StartCounts> {
  const close = revealAt(config);
  if (config.maxAttempts === null && !close)
    return { used: 0, usedSinceClose: 0, extra: 0 };
  const [row] = await db
    .select({
      used: sql<number>`count(*) filter (where ${attempts.status} <> 'in_progress')`,
      usedSinceClose: close
        ? sql<number>`count(*) filter (where ${attempts.startedAt} >= ${close.toISOString()}::timestamptz)`
        : sql<number>`0`,
      extra: sql<number>`coalesce((
        select ${attemptOverrides.extraAttempts} from ${attemptOverrides}
        where ${attemptOverrides.userId} = ${userId}
          and ${attemptOverrides.lessonId} = ${lessonId}
      ), 0)`,
    })
    .from(attempts)
    .where(and(eq(attempts.userId, userId), eq(attempts.lessonId, lessonId)));
  return {
    used: Number(row?.used ?? 0),
    usedSinceClose: Number(row?.usedSinceClose ?? 0),
    extra: Number(row?.extra ?? 0),
  };
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
