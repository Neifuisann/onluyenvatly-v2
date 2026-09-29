import { Info } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AiExplanation } from "@/features/ai/components/ai-explanation";
import { needsAi, questionHash } from "@/features/ai/domain/explain";
import { getReviewExplanations } from "@/features/ai/queries";
import { ChoiceItem } from "@/features/attempts/components/result/choice-item";
import { DeleteAttempt } from "@/features/attempts/components/result/delete-attempt";
import { GuardTimeline } from "@/features/attempts/components/result/guard-timeline";
import { ReviewItem } from "@/features/attempts/components/result/review-item";
import { ReviewList } from "@/features/attempts/components/result/review-list";
import { ScoreHero } from "@/features/attempts/components/result/score-hero";
import { buildReview, revealFor } from "@/features/attempts/domain/review";
import { revealAt } from "@/features/attempts/domain/schedule";
import { resultCopy, reviewCopy } from "@/features/attempts/messages";
import { getAttempt } from "@/features/attempts/queries";
import { AttemptIdSchema } from "@/features/attempts/schemas";
import { requireStudent } from "@/features/auth/guards";
import { withOptionOrder } from "@/features/lessons/domain/public-question";
import {
  getLessonForTaking,
  getLessonOverview,
  getLessonWithAnswers,
} from "@/features/lessons/queries";
import { getAttemptRatingEvent } from "@/features/rating/queries";
import { getSettings } from "@/features/settings/queries";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = {
  title: resultCopy.title,
  robots: { index: false, follow: false },
};

/**
 * `/attempts/[id]/result`: owner or admin (05 §1). The answer key is read
 * and rendered only when the lesson's `revealAnswers` allows it (ADR-004).
 * Admins also get the exam-guard timeline and "Xóa bài làm" (S6-04).
 * With the review come the stored AI explanations (S7-02): one lookup by
 * question hash, never before the answers may be shown.
 */
export default async function AttemptResultPage({
  params,
}: PageProps<"/attempts/[id]/result">) {
  const user = await requireStudent();
  const parsed = AttemptIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const attempt = await getAttempt(parsed.data);
  if (!attempt || (attempt.userId !== user.id && user.role !== "admin"))
    notFound();
  if (attempt.status === "in_progress") {
    if (attempt.userId === user.id) redirect(`/attempts/${attempt.id}`);
    notFound();
  }
  const { lessonId, lessonVersionId } = attempt;
  const [lesson, rating] = await Promise.all([
    lessonId ? getLessonOverview(lessonId, true) : null,
    getAttemptRatingEvent(attempt.id),
  ]);
  const reveal = revealFor(
    lesson?.revealAnswers ?? "never",
    lesson ? revealAt(lesson) : null,
    new Date(),
    user.role === "admin",
  );
  const shown = reveal.kind === "shown";
  // Hidden: only the answer-free view is read, never the key.
  const [questions, publicQuestions] =
    lessonId && lessonVersionId
      ? await Promise.all([
          shown ? getLessonWithAnswers(lessonId, lessonVersionId) : null,
          shown ? null : getLessonForTaking(lessonId, lessonVersionId),
        ])
      : [null, null];
  const publicById = new Map(publicQuestions?.map((q) => [q.id, q]));
  const entries = questions
    ? buildReview(
        attempt.items,
        attempt.answers,
        attempt.earned,
        new Map(questions.map((q) => [q.id, q])),
      )
    : null;
  const hashes = entries?.map((e) =>
    needsAi(e.question) ? questionHash(e.question) : null,
  );
  const [explanations, settings] = hashes
    ? await Promise.all([
        getReviewExplanations(
          user.id,
          hashes.filter((h) => h !== null),
        ),
        getSettings(),
      ])
    : [null, null];

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-8">
      <ScoreHero
        attempt={attempt}
        lessonTitle={lesson?.title ?? ""}
        rating={rating}
        hasReview={entries !== null}
      />
      {entries ? (
        <ReviewList
          items={entries.map((entry, i) => {
            const hash = hashes?.[i];
            return {
              outcome: entry.outcome,
              node: (
                <ReviewItem
                  entry={entry}
                  ai={
                    hash && (
                      <AiExplanation
                        attemptId={attempt.id}
                        index={entry.index}
                        explanation={explanations?.get(hash)}
                        canAsk={settings?.aiEnabled ?? false}
                      />
                    )
                  }
                />
              ),
            };
          })}
        />
      ) : (
        <section
          aria-labelledby="choices-heading"
          className="flex flex-col gap-4"
        >
          <h2 id="choices-heading" className="font-semibold text-lg">
            {reviewCopy.heading}
          </h2>
          <p className="flex items-start gap-2 rounded-lg border bg-surface p-4 text-sm">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
            {reveal.kind === "later"
              ? resultCopy.revealLater(formatDateTime(reveal.at))
              : resultCopy.revealNever}
          </p>
          {attempt.items.map((item, i) => {
            const q = publicById.get(item.q);
            return (
              q && (
                <ChoiceItem
                  // Position, not the question id: keys ship in the RSC payload.
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed test order
                  key={i}
                  index={i}
                  question={withOptionOrder(q, item.o)}
                  given={attempt.answers[i] ?? null}
                />
              )
            );
          })}
        </section>
      )}
      {user.role === "admin" && (
        <>
          <GuardTimeline events={attempt.guardEvents} />
          <DeleteAttempt attemptId={attempt.id} />
        </>
      )}
    </article>
  );
}
