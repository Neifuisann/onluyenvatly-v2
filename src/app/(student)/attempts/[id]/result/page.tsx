import { Info } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ReviewItem } from "@/features/attempts/components/result/review-item";
import { ReviewList } from "@/features/attempts/components/result/review-list";
import { ScoreHero } from "@/features/attempts/components/result/score-hero";
import { buildReview, revealFor } from "@/features/attempts/domain/review";
import { resultCopy } from "@/features/attempts/messages";
import { getAttempt } from "@/features/attempts/queries";
import { AttemptIdSchema } from "@/features/attempts/schemas";
import { requireStudent } from "@/features/auth/guards";
import {
  getLessonOverview,
  getLessonWithAnswers,
} from "@/features/lessons/queries";
import { getAttemptRatingEvent } from "@/features/rating/queries";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = {
  title: resultCopy.title,
  robots: { index: false, follow: false },
};

/**
 * `/attempts/[id]/result`: owner or admin (05 §1). The answer key is read
 * and rendered only when the lesson's `revealAnswers` allows it (ADR-004).
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
    attempt.deadlineAt,
    new Date(),
    user.role === "admin",
  );
  const questions =
    reveal.kind === "shown" && lessonId && lessonVersionId
      ? await getLessonWithAnswers(lessonId, lessonVersionId)
      : null;
  const entries = questions
    ? buildReview(
        attempt.items,
        attempt.answers,
        attempt.earned,
        new Map(questions.map((q) => [q.id, q])),
      )
    : null;

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
          items={entries.map((entry) => ({
            outcome: entry.outcome,
            node: <ReviewItem entry={entry} />,
          }))}
        />
      ) : (
        <p className="flex items-start gap-2 rounded-lg border bg-surface p-4 text-sm">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {reveal.kind === "later"
            ? resultCopy.revealLater(formatDateTime(reveal.at))
            : resultCopy.revealNever}
        </p>
      )}
    </article>
  );
}
