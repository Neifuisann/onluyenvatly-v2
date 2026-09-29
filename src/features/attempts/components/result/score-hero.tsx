import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CircleCheck,
  Clock,
  ListChecks,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { Mascot, type MascotPose } from "@/components/mascot";
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

/** The bunny cheers a great score and encourages a low one, never blames (07 §1.5). */
function reaction(score10: number): { pose: MascotPose; message: string } {
  if (score10 >= 8) return { pose: "celebrate", message: t.good };
  if (score10 >= 5) return { pose: "ok", message: t.okay };
  return { pose: "keep-going", message: t.keepGoing };
}

const R = 52;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** The score as a ring filling towards 10; it sweeps in once (CSS only). */
function ScoreRing({ score10 }: { score10: number }) {
  const offset = CIRCUMFERENCE * (1 - Math.min(10, Math.max(0, score10)) / 10);
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 120"
      className="-rotate-90 absolute inset-0 size-full"
    >
      <circle
        cx="60"
        cy="60"
        r={R}
        fill="none"
        strokeWidth="9"
        className="stroke-ink-foreground/12"
      />
      <circle
        cx="60"
        cy="60"
        r={R}
        fill="none"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        style={{ ["--ring-len" as string]: CIRCUMFERENCE }}
        className="animate-ring stroke-accent"
      />
    </svg>
  );
}

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
  const { pose, message } = reaction(score10);
  const chip =
    "inline-flex items-center gap-1.5 rounded-full bg-ink-foreground/10 px-3 py-1.5";
  return (
    <header className="flex flex-col gap-5">
      <div className="space-y-1">
        <p className="eyebrow text-muted-foreground">{t.title}</p>
        <h1 className="heading-page break-words">{lessonTitle}</h1>
      </div>
      <section
        aria-label={t.scoreLabel}
        className="relative isolate animate-rise overflow-hidden rounded-xl bg-ink p-6 text-ink-foreground shadow-raised sm:p-8"
      >
        <span
          aria-hidden
          className="-z-10 -top-28 -left-20 absolute size-80 rounded-full bg-primary/30 blur-3xl"
        />
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left">
          <div className="relative flex size-44 shrink-0 flex-col items-center justify-center">
            <ScoreRing score10={score10} />
            <p className="num font-bold font-display text-5xl leading-none tracking-tight">
              <span className="sr-only">{formatScore(score10)}</span>
              <span aria-hidden>
                <CountUp value={score10} />
              </span>
            </p>
            <p className="mt-1 text-ink-muted text-sm">{t.outOf}</p>
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <p className="font-display font-semibold text-2xl leading-tight tracking-tight">
              {message}
            </p>
            <ul className="flex flex-wrap justify-center gap-2 text-sm sm:justify-start">
              <li className={chip}>
                <CircleCheck aria-hidden className="size-4 text-accent" />
                {t.correct(
                  correctCount(attempt.items, attempt.earned),
                  attempt.items.length,
                )}
              </li>
              <li className={chip}>
                <ListChecks aria-hidden className="size-4 text-accent" />
                {t.points(
                  formatScore(attempt.score ?? 0),
                  formatScore(attempt.maxScore),
                )}
              </li>
              {attempt.timeTakenSec !== null && (
                <li className={chip}>
                  <Clock aria-hidden className="size-4 text-accent" />
                  {t.time(formatClock(attempt.timeTakenSec))}
                </li>
              )}
            </ul>
            {rating ? (
              <RatingChange rating={rating} />
            ) : (
              <p className="text-ink-muted text-sm">{ratingCopy.notRated}</p>
            )}
            {attempt.submittedAt && (
              <p className="text-ink-muted text-xs">
                {t.submittedAt(formatDateTime(attempt.submittedAt))}
              </p>
            )}
          </div>
          <Mascot
            pose={pose}
            size={150}
            priority
            className="-order-1 w-28 animate-pop sm:order-none sm:w-[150px]"
          />
        </div>
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
        <Link
          // Personalized practice (S7-06) goes back to the mistakes bank.
          href={attempt.lessonId ? `/lessons/${attempt.lessonId}` : "/review"}
          className={cn(
            buttonVariants({ size: "lg" }),
            !hasReview && "col-span-2",
          )}
        >
          <RotateCcw aria-hidden />
          {attempt.lessonId ? t.retake : t.backToReview}
        </Link>
      </div>
    </header>
  );
}

function RatingChange({ rating }: { rating: AttemptRatingEvent }) {
  const { before, after, delta } = rating;
  const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : ArrowRight;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm sm:justify-start">
      <span className="text-ink-muted">
        {ratingCopy.label}{" "}
        <span className="num font-semibold text-ink-foreground">
          {ratingCopy.change(formatRating(before), formatRating(after))}
        </span>
      </span>
      <span
        className={cn(
          "num inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold",
          delta > 0 && "bg-success-soft text-success-text",
          delta < 0 && "bg-danger-soft text-danger-text",
          delta === 0 && "bg-ink-foreground/10",
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
      <TierBadge rating={after} className="text-foreground" />
    </div>
  );
}
