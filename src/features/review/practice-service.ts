import "server-only";
import { randomInt } from "node:crypto";
import { db } from "@/db/client";
import { attempts } from "@/db/schema";
import { createRng } from "@/features/attempts/domain/random";
import { getLessonWithAnswers } from "@/features/lessons/queries";
import type { Question } from "@/features/lessons/schema";
import { rateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";
import {
  type BankFilters,
  MAX_CANDIDATES,
  pickMistakes,
  REVIEW_POINTS,
  reviewItems,
} from "./domain/practice";
import { reviewCopy as t } from "./messages";
import { getOpenReview, getPracticeCandidates } from "./queries";

export const REVIEW_LIMITS = { startPerUser: [10, "1m"] } as const;

export type StartReviewInput = BankFilters & { count: number };

/**
 * "Tạo bài ôn tập" (05 `startReviewPractice`, S7-06): a `review` attempt
 * from my open mistakes whose answers may be shown, the most missed first.
 * It has no lesson, no time limit and no rating; each item keeps its own
 * version. One open practice per student (a unique partial index), so an
 * open one is returned instead of starting another.
 */
export async function startReviewPractice(
  user: { id: string },
  input: StartReviewInput,
  {
    ip = null,
    now = new Date(),
    seed = randomInt(0, 2 ** 32),
  }: { ip?: string | null; now?: Date; seed?: number } = {},
): Promise<Result<{ attemptId: string; resumed: boolean }>> {
  const limit = await rateLimit(
    `review:start:${user.id}`,
    ...REVIEW_LIMITS.startPerUser,
    now,
  );
  if (!limit.ok) return err("RATE_LIMITED");
  const openReview = await getOpenReview(user.id);
  if (openReview) return ok({ attemptId: openReview.id, resumed: true });

  const rng = createRng(seed);
  const candidates = await getPracticeCandidates(
    user.id,
    input,
    MAX_CANDIDATES,
    now,
  );
  const picked = pickMistakes(candidates, input.count, rng);
  const versions = new Map<number, Question[] | null>();
  for (const p of picked)
    if (!versions.has(p.versionId))
      versions.set(
        p.versionId,
        await getLessonWithAnswers(p.lessonId, p.versionId),
      );
  const chosen = picked.flatMap((p) => {
    const question = versions
      .get(p.versionId)
      ?.find((q) => q.id === p.questionId);
    // A question removed from its version (B-10) is not practised.
    return question && !question.removed
      ? [{ question, versionId: p.versionId }]
      : [];
  });
  if (chosen.length === 0) return err("NOT_FOUND", { message: t.nothing });

  const items = reviewItems(chosen, rng);
  const [created] = await db
    .insert(attempts)
    .values({
      userId: user.id,
      lessonId: null,
      lessonVersionId: null,
      mode: "review",
      items,
      answers: items.map(() => null),
      maxScore: items.length * REVIEW_POINTS,
      startedAt: now,
      deadlineAt: null,
      ip,
    })
    // A parallel start won: use that one.
    .onConflictDoNothing()
    .returning({ id: attempts.id });
  if (created) return ok({ attemptId: created.id, resumed: false });
  const winner = await getOpenReview(user.id);
  return winner ? ok({ attemptId: winner.id, resumed: true }) : err("CONFLICT");
}
