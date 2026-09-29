import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, type Executor } from "@/db/client";
import { explanationVotes, questionExplanations } from "@/db/schema";
import { revealFor } from "@/features/attempts/domain/review";
import { revealAt } from "@/features/attempts/domain/schedule";
import { getAttempt } from "@/features/attempts/queries";
import type { SessionUser } from "@/features/auth/session";
import {
  getLessonOverview,
  getLessonWithAnswers,
} from "@/features/lessons/queries";
import type { Question } from "@/features/lessons/schema";
import { rateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";
import { ai as defaultAi } from "./client";
import {
  buildExplainPrompt,
  cleanExplanation,
  EXPLAIN_MAX_OUTPUT_TOKENS,
  EXPLAIN_SYSTEM,
  needsAi,
  PROMPT_VERSION,
  questionHash,
  type Vote,
  voteDelta,
} from "./domain/explain";
import { AI_TIMEOUT_MS } from "./domain/policy";
import type { Ai, AiFailure, AiText } from "./gemini";
import { explainCopy as t } from "./messages";

/** Explanations a student may request per day; cache hits are free (06 §4). */
export const EXPLAIN_PER_USER_DAY = 20;

type Target = { question: Question; hash: string; lessonId: number };

/**
 * `{ attemptId, index }` → the question, only if this user may see its
 * answer now: the attempt's owner (or an admin), submitted, and the lesson's
 * `revealAnswers` allows it (ADR-004). Everything else is `NOT_FOUND` /
 * `FORBIDDEN`, so the endpoint can't be used to fish for answers.
 */
async function resolveTarget(
  user: SessionUser,
  attemptId: string,
  index: number,
  now: Date,
): Promise<Result<Target>> {
  const attempt = await getAttempt(attemptId);
  if (!attempt || (attempt.userId !== user.id && user.role !== "admin"))
    return err("NOT_FOUND");
  const item = attempt.items[index];
  const { lessonId, lessonVersionId } = attempt;
  if (!item || !lessonId || !lessonVersionId) return err("NOT_FOUND");
  if (attempt.status === "in_progress") return err("FORBIDDEN");
  const lesson = await getLessonOverview(lessonId, true);
  const reveal = revealFor(
    lesson?.revealAnswers ?? "never",
    lesson ? revealAt(lesson) : null,
    now,
    user.role === "admin",
  );
  if (reveal.kind !== "shown") return err("FORBIDDEN");
  const questions = await getLessonWithAnswers(
    lessonId,
    item.v ?? lessonVersionId,
  );
  const question = questions?.find((q) => q.id === item.q);
  if (!question) return err("NOT_FOUND");
  // The teacher's own explanation is shown instead (ADR-007).
  if (!needsAi(question)) return err("VALIDATION");
  return ok({ question, hash: questionHash(question), lessonId });
}

async function findContent(hash: string): Promise<string | null> {
  const [row] = await db
    .select({ contentMd: questionExplanations.contentMd })
    .from(questionExplanations)
    .where(eq(questionExplanations.questionHash, hash))
    .limit(1);
  return row?.contentMd ?? null;
}

/**
 * Stores a finished explanation. Two students asking at once both generate;
 * the first insert wins and the other is dropped.
 */
export async function storeExplanation(
  exec: Executor,
  target: Target,
  text: AiText,
): Promise<void> {
  await exec
    .insert(questionExplanations)
    .values({
      questionHash: target.hash,
      lessonId: target.lessonId,
      questionId: target.question.id,
      source: "ai",
      model: text.usage.model,
      promptVersion: PROMPT_VERSION,
      contentMd: cleanExplanation(text.text),
    })
    .onConflictDoNothing();
}

/** The request for one explanation (09 §3). */
export function explainRequest(question: Question, feature: string) {
  return {
    feature,
    kind: "text" as const,
    system: EXPLAIN_SYSTEM,
    contents: buildExplainPrompt(question),
    timeoutMs: AI_TIMEOUT_MS.explain,
    maxOutputTokens: EXPLAIN_MAX_OUTPUT_TOKENS,
    temperature: 0.3,
  };
}

export type ExplainOutcome =
  | { kind: "cached"; contentMd: string }
  | {
      kind: "stream";
      chunks: AsyncIterable<string>;
      /** Settles after the text is stored (or refused as incomplete). */
      done: Promise<{ ok: true; stored: boolean } | AiFailure>;
    };

const failure = (f: AiFailure) =>
  err(f.code, {
    message: f.code === "AI_QUOTA" ? t.quota : t.unavailable,
  });

/**
 * `explainQuestion` (05 §2, S7-02): cache first, and a hit costs nothing.
 * A miss counts against the student's 20 a day (admins are exempt), then
 * the global gate (inside the wrapper), then streams from Gemini. The text
 * is stored only when complete.
 */
export async function explainQuestion(
  user: SessionUser,
  input: { attemptId: string; index: number },
  deps: { ai?: Ai; now?: Date } = {},
): Promise<Result<ExplainOutcome>> {
  const now = deps.now ?? new Date();
  const target = await resolveTarget(user, input.attemptId, input.index, now);
  if (!target.ok) return target;
  const cached = await findContent(target.data.hash);
  if (cached) return ok({ kind: "cached", contentMd: cached });

  if (user.role !== "admin") {
    const limit = await rateLimit(
      `ai:explain:${user.id}`,
      EXPLAIN_PER_USER_DAY,
      "1d",
      now,
    );
    if (!limit.ok) return err("AI_QUOTA", { message: t.userLimit });
  }

  const stream = await (deps.ai ?? defaultAi).streamText(
    explainRequest(target.data.question, "explain"),
  );
  if (!stream.ok) return failure(stream);
  const done = stream.result.then(async (r) => {
    if (!r.ok) return r;
    if (!r.complete) return { ok: true as const, stored: false };
    await storeExplanation(db, target.data, r);
    return { ok: true as const, stored: true };
  });
  return ok({ kind: "stream", chunks: stream.chunks, done });
}

export type VoteResult = { votesUp: number; votesDown: number; vote: Vote };

/**
 * One vote per student per explanation (05 `voteExplanation`): set, change
 * or clear it, with the counters moved in the same transaction.
 */
export async function voteExplanation(
  user: SessionUser,
  input: { hash: string; vote: Vote },
): Promise<Result<VoteResult>> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        votesUp: questionExplanations.votesUp,
        votesDown: questionExplanations.votesDown,
      })
      .from(questionExplanations)
      .where(eq(questionExplanations.questionHash, input.hash))
      .for("update")
      .limit(1);
    if (!row) return err("NOT_FOUND");
    const mine = and(
      eq(explanationVotes.questionHash, input.hash),
      eq(explanationVotes.userId, user.id),
    );
    const [prev] = await tx
      .select({ up: explanationVotes.up })
      .from(explanationVotes)
      .where(mine)
      .limit(1);
    const before: Vote = prev ? (prev.up ? "up" : "down") : null;
    const delta = voteDelta(before, input.vote);
    if (input.vote === null) await tx.delete(explanationVotes).where(mine);
    else
      await tx
        .insert(explanationVotes)
        .values({
          questionHash: input.hash,
          userId: user.id,
          up: input.vote === "up",
        })
        .onConflictDoUpdate({
          target: [explanationVotes.questionHash, explanationVotes.userId],
          set: { up: input.vote === "up" },
        });
    if (delta.up === 0 && delta.down === 0)
      return ok({ ...row, vote: input.vote });
    const [updated] = await tx
      .update(questionExplanations)
      .set({
        votesUp: sql`${questionExplanations.votesUp} + ${delta.up}`,
        votesDown: sql`${questionExplanations.votesDown} + ${delta.down}`,
      })
      .where(eq(questionExplanations.questionHash, input.hash))
      .returning({
        votesUp: questionExplanations.votesUp,
        votesDown: questionExplanations.votesDown,
      });
    return ok({ ...(updated ?? row), vote: input.vote });
  });
}
