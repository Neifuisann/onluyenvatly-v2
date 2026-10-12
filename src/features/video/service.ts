import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { attempts, lessons, type VideoState } from "@/db/schema";
import { type SubmitOutcome, submitAttempt } from "@/features/attempts/service";
import { LessonConfigSchema } from "@/features/lessons/schema";
import { err, ok, type Result } from "@/lib/result";
import { answerCue, canFinish, cueItems, progressTo } from "./domain/engine";
import type { VideoMove } from "./schemas";

export type VideoView = {
  state: VideoState;
  /** Set once the attempt is graded: the student goes to the result. */
  result?: Pick<SubmitOutcome, "score" | "maxScore" | "score10">;
};

/**
 * One step of a video lesson. Answers leave the browser one cue at a time
 * and are graded only when the video is over (ADR-004): nothing about a key
 * comes back before the result page. Without `seek`, a cue can't be
 * answered before the wall clock could have played the video that far.
 *
 * `progress` (every ~20 s while playing, and when the page hides) is one
 * read and one key-merging UPDATE that never touches the answers or the
 * cue count, so it can't undo a concurrent answer. Not rate limited, like
 * the zombie moves: the client paces it and each call is two small
 * primary-key queries.
 */
export async function videoMove(
  userId: string,
  attemptId: string,
  move: VideoMove,
  now = new Date(),
): Promise<Result<VideoView>> {
  const [pre] = await db
    .select({
      userId: attempts.userId,
      mode: attempts.mode,
      status: attempts.status,
      startedAt: attempts.startedAt,
      video: attempts.video,
      config: lessons.config,
    })
    .from(attempts)
    .leftJoin(lessons, eq(lessons.id, attempts.lessonId))
    .where(eq(attempts.id, attemptId))
    .limit(1);
  if (!pre || pre.userId !== userId) return err("NOT_FOUND");
  if (pre.mode !== "video" || !pre.video) return err("FORBIDDEN");
  if (pre.status !== "in_progress") return err("ATTEMPT_CLOSED");
  const elapsed = (now.getTime() - pre.startedAt.getTime()) / 1000;
  const config = LessonConfigSchema.safeParse(pre.config);
  const durationSec = config.success
    ? (config.data.video?.durationSec ?? null)
    : null;

  if (move.kind === "progress") {
    const p = progressTo(pre.video, move.pos, elapsed);
    const [row] = await db
      .update(attempts)
      .set({
        video: sql`${attempts.video} || jsonb_build_object(
          'pos', ${p.pos}::float8,
          'max', greatest(coalesce((${attempts.video}->>'max')::float8, 0), ${p.max}::float8)
        )`,
        lastSavedAt: now,
      })
      .where(
        and(eq(attempts.id, attemptId), eq(attempts.status, "in_progress")),
      )
      .returning({ video: attempts.video });
    if (!row?.video) return err("ATTEMPT_CLOSED");
    return ok({ state: row.video });
  }

  if (move.kind === "finish") {
    const check = canFinish(pre.video, elapsed, durationSec);
    if (!check.ok)
      return err(check.code === "TOO_EARLY" ? "VIDEO_TOO_EARLY" : "VALIDATION");
    return finished(userId, attemptId, pre.video, now);
  }

  const step = await db.transaction(async (tx) => {
    const [a] = await tx
      .select({
        status: attempts.status,
        answers: attempts.answers,
        video: attempts.video,
      })
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .for("update")
      .limit(1);
    if (!a || a.status !== "in_progress" || !a.video)
      return err("ATTEMPT_CLOSED");
    const r = answerCue(a.video, move.cue, elapsed, durationSec);
    // A retried request: the first one already stored this cue.
    if (!r.ok && r.code === "ANSWERED") return ok(a.video);
    if (!r.ok)
      return err(r.code === "TOO_EARLY" ? "VIDEO_TOO_EARLY" : "VALIDATION");
    const { from, to } = cueItems(a.video.cues, move.cue);
    if (move.answers.length !== to - from) return err("VALIDATION");
    const answers = [...a.answers];
    answers.splice(from, to - from, ...move.answers);
    await tx
      .update(attempts)
      .set({ answers, video: r.state, lastSavedAt: now })
      .where(eq(attempts.id, attemptId));
    return ok(r.state);
  });
  if (!step.ok) return step;

  // The questions at the end of the video were the last: grade now.
  const state = step.data;
  const last = state.cues.at(-1);
  if (state.done === state.cues.length && last?.at === null)
    return finished(userId, attemptId, state, now);
  return ok({ state });
}

async function finished(
  userId: string,
  attemptId: string,
  state: VideoState,
  now: Date,
): Promise<Result<VideoView>> {
  const graded = await finishVideo(userId, attemptId, now);
  // Should grading fail, the runner page grades it on the next visit.
  if (!graded.ok) return ok({ state });
  const { score, maxScore, score10 } = graded.data;
  return ok({ state, result: { score, maxScore, score10 } });
}

/** Grades a video attempt with the answers its cues stored. */
export function finishVideo(userId: string, attemptId: string, now: Date) {
  return submitAttempt(
    userId,
    attemptId,
    { answers: [], flagged: [], clientSubmitId: randomUUID() },
    now,
  );
}
