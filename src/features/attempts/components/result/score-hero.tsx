import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CircleCheck,
  Clock,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { TierBadge } from "@/features/rating/components/tier-badge";
import { formatRating, ratingCopy } from "@/features/rating/messages";
import type { AttemptRatingEvent } from "@/features/rating/queries";
import { formatClock, formatDateTime, formatScore } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { correctCount } from "../../domain/review";
import { resultCopy as t } from "../../messages";
import type { AttemptView } from "../../queries";
import { CountUp } from "./count-up";

/**
 * Big score /10, points, time and the rating change (07 §4, §5.4). Only the
 * stored marks are read here; nothing in it depends on the answers.
 */
export function ScoreHero({
  attempt,
  lessonTitle,
  rating,
  hasReview,
}: {
  attempt: AttemptView;
  lessonTitle: string;
  rating: AttemptRatingEvent | null;
  hasReview: boolean;
}) {
  const score10 = attempt.score10 ?? 0;
  return (
    <header className="flex flex-col gap-4">
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm">{t.title}</p>
        <h1 className="break-words font-semibold text-2xl">{lessonTitle}</h1>
      </div>
      <section
        aria-label={t.scoreLabel}
        className="rounded-lg border bg-surface p-6 text-center shadow-card"
      >
        <p className="font-mono font-semibold text-5xl tabular-nums">
          <span className="sr-only">{formatScore(score10)}</span>
          <span aria-hidden>
            <CountUp value={score10} />
          </span>{" "}
          <span className="text-2xl text-muted-foreground">{t.outOf}</span>
        </p>
        <p className="mt-2 font-medium">
          {score10 >= 8 ? t.good : t.keepGoing}
        </p>
        <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-muted-foreground text-sm">
          <li className="flex items-center gap-1.5">
            <CircleCheck aria-hidden className="size-4" />
            {t.correct(
              correctCount(attempt.items, attempt.earned),
              attempt.items.length,
            )}
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
        {rating ? (
          <RatingChange rating={rating} />
        ) : (
          <p className="mt-4 text-muted-foreground text-sm">
            {ratingCopy.notRated}
          </p>
        )}
        {attempt.submittedAt && (
          <p className="mt-3 text-muted-foreground text-xs">
            {t.submittedAt(formatDateTime(attempt.submittedAt))}
          </p>
        )}
      </section>
      <div className="grid grid-cols-2 gap-3 sm:flex">
        {hasReview && (
          <a
            href="#review"
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            {t.review}
          </a>
        )}
        {attempt.lessonId && (
          <Link
            href={`/lessons/${attempt.lessonId}`}
            className={cn(
              buttonVariants({ size: "lg" }),
              !hasReview && "col-span-2",
            )}
          >
            <RotateCcw aria-hidden />
            {t.retake}
          </Link>
        )}
      </div>
    </header>
  );
}

function RatingChange({ rating }: { rating: AttemptRatingEvent }) {
  const { before, after, delta } = rating;
  const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : ArrowRight;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm">
      <span>
        {ratingCopy.label}{" "}
        <span className="font-mono tabular-nums">
          {ratingCopy.change(formatRating(before), formatRating(after))}
        </span>
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-0.5 font-medium font-mono tabular-nums",
          delta > 0 && "text-success-text",
          delta < 0 && "text-danger-text",
        )}
      >
        <Icon aria-hidden className="size-4" />
        <span aria-hidden>
          {delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : "0"}
        </span>
        <span className="sr-only">
          {delta > 0
            ? ratingCopy.up(delta)
            : delta < 0
              ? ratingCopy.down(-delta)
              : ratingCopy.same}
        </span>
      </span>
      <TierBadge rating={after} />
    </div>
  );
}
