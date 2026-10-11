import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { attempts, type ZombieState } from "@/db/schema";
import { itemQuestions } from "@/features/attempts/content";
import { type SubmitOutcome, submitAttempt } from "@/features/attempts/service";
import { err, ok, type Result } from "@/lib/result";
import {
  applyAnswer,
  begin,
  type GameEvent,
  shoot,
  timeout,
  waveKey,
} from "./domain/engine";
import type { GameMove } from "./schemas";

export type GameView = {
  state: ZombieState;
  event: GameEvent | null;
  /** Server clock (epoch ms), so the browser can correct its own. */
  now: number;
  /** Set once the game is over and graded. */
  result?: Pick<SubmitOutcome, "score" | "maxScore" | "score10">;
};

/**
 * One move of a zombie game (B-11): start, a shot or a timeout. The row lock
 * serializes a student's moves, so a double tap or a retried request counts
 * once (`stale`). The key of a wave is read here and leaves the server only
 * when that wave has ended (ADR-004). The game's last move grades the
 * attempt like a submit, rating and mistakes included.
 *
 * Not rate limited: the rules bound the moves of a game (one hit per wave,
 * at most `lives` misses, a break between waves) and starts are limited.
 */
export async function playMove(
  userId: string,
  attemptId: string,
  move: GameMove,
  now = new Date(),
): Promise<Result<GameView>> {
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
    .where(eq(attempts.id, attemptId))
    .limit(1);
  if (!pre || pre.userId !== userId) return err("NOT_FOUND");
  if (pre.mode !== "game") return err("FORBIDDEN");
  if (pre.status !== "in_progress") return err("ATTEMPT_CLOSED");
  // From the shared cache: a class playing together reads it once.
  const questions = move.kind === "begin" ? [] : await itemQuestions(pre);
  if (!questions) return err("INTERNAL");
  const t = now.getTime();

  const step = await db.transaction(async (tx) => {
    const [a] = await tx
      .select({
        status: attempts.status,
        answers: attempts.answers,
        game: attempts.game,
      })
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .for("update")
      .limit(1);
    if (!a || a.status !== "in_progress" || !a.game)
      return err("ATTEMPT_CLOSED");
    const state = a.game;
    if (move.kind === "begin") {
      const next = begin(state, t);
      if (next !== state)
        await tx
          .update(attempts)
          .set({ game: next })
          .where(eq(attempts.id, attemptId));
      return ok({ state: next, event: null });
    }

    const wave = state.waves[move.wave];
    const item = wave && pre.items[wave.i];
    const question = wave && questions[wave.i];
    if (!wave || !item || !question) return err("VALIDATION");
    const key = waveKey(question, item, wave);
    const r =
      move.kind === "shoot"
        ? shoot(state, move, key, t)
        : timeout(state, move.wave, key, t);
    if (!r.ok) return err(r.code === "OVER" ? "GAME_OVER" : "VALIDATION");
    if (r.state !== state) {
      const statements =
        question.type === "tf" ? question.statements.length : 0;
      await tx
        .update(attempts)
        .set({
          game: r.state,
          ...(r.answer && {
            answers: applyAnswer(a.answers, r.answer, statements),
          }),
        })
        .where(eq(attempts.id, attemptId));
    }
    return ok({ state: r.state, event: r.event });
  });
  if (!step.ok) return step;

  const { state, event } = step.data;
  const view: GameView = { state, event, now: t };
  if (!state.over) return ok(view);
  // Grade now. Should this fail, the runner page grades it on the next visit.
  const graded = await finishGame(userId, attemptId, now);
  if (graded.ok) {
    const { score, maxScore, score10 } = graded.data;
    view.result = { score, maxScore, score10 };
  }
  return ok(view);
}

/** Grades a game with the answers its shots stored (B-11). */
export function finishGame(userId: string, attemptId: string, now: Date) {
  return submitAttempt(
    userId,
    attemptId,
    { answers: [], flagged: [], clientSubmitId: randomUUID() },
    now,
  );
}
