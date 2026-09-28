import { ArrowLeft, CircleCheck, Clock, Info } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { toCents } from "@/features/grading/domain/points";
import { formatClock, formatDateTime, formatScore } from "@/lib/dates";
import { resultCopy as t } from "../messages";
import type { AttemptView } from "../queries";

/** Items with full marks (tf partial credit doesn't count as correct). */
export function correctCount(
  attempt: Pick<AttemptView, "items" | "earned">,
): number {
  return attempt.items.filter(
    (item, i) => toCents(attempt.earned?.[i] ?? 0) >= toCents(item.p),
  ).length;
}

/**
 * `ScoreHero`-lite for S3: the server's score, points and time. No answers
 * yet: what to reveal is decided by `revealAnswers` in S4-03.
 */
export function ResultSummary({
  attempt,
  lessonTitle,
}: {
  attempt: AttemptView;
  lessonTitle: string;
}) {
  const score10 = attempt.score10 ?? 0;
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="space-y-1">
        <p className="text-muted-foreground text-sm">{t.title}</p>
        <h1 className="break-words font-semibold text-2xl">{lessonTitle}</h1>
      </header>
      <section
        aria-label={t.scoreLabel}
        className="rounded-lg border bg-surface p-6 text-center shadow-card"
      >
        <p className="font-mono font-semibold text-5xl tabular-nums">
          {formatScore(score10)}{" "}
          <span className="text-2xl text-muted-foreground">{t.outOf}</span>
        </p>
        <p className="mt-2 font-medium">
          {score10 >= 8 ? t.good : t.keepGoing}
        </p>
        <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-muted-foreground text-sm">
          <li className="flex items-center gap-1.5">
            <CircleCheck aria-hidden className="size-4" />
            {t.correct(correctCount(attempt), attempt.items.length)}
          </li>
          <li>
            {t.points(
              formatScore(attempt.score ?? 0),
              formatScore(attempt.maxScore),
            )}
          </li>
          {attempt.timeTakenSec !== null && (
            <li className="flex items-center gap-1.5">
              <Clock aria-hidden className="size-4" />
              {t.time(formatClock(attempt.timeTakenSec))}
            </li>
          )}
        </ul>
        {attempt.submittedAt && (
          <p className="mt-3 text-muted-foreground text-xs">
            {t.submittedAt(formatDateTime(attempt.submittedAt))}
          </p>
        )}
      </section>
      <p className="flex items-start gap-2 text-muted-foreground text-sm">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t.reviewSoon}
      </p>
      <div className="flex flex-wrap gap-3">
        {attempt.lessonId && (
          <Link
            href={`/lessons/${attempt.lessonId}`}
            className={buttonVariants({ size: "lg" })}
          >
            <ArrowLeft aria-hidden />
            {t.backToLesson}
          </Link>
        )}
        <Link
          href="/lessons"
          className={buttonVariants({ variant: "secondary", size: "lg" })}
        >
          {t.toCatalog}
        </Link>
      </div>
    </article>
  );
}
