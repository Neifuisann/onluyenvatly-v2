import { ArrowRight, ChevronRight, Repeat, Trophy } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RatingDelta } from "@/features/rating/components/rating-delta";
import { RatingSparkline } from "@/features/rating/components/rating-sparkline";
import { TierBadge } from "@/features/rating/components/tier-badge";
import { ratingSeries } from "@/features/rating/domain/sparkline";
import { formatRating, ratingCopy } from "@/features/rating/messages";
import { formatClock } from "@/lib/dates";
import type { ContinueSummary } from "../domain/dashboard";
import { dashboardCopy as t } from "../messages";
import type { RatingPoint } from "../queries";

/** "Đang làm dở": the test I left, with a big resume button (07 §5.1). */
export function ContinueCard({
  attemptId,
  lessonTitle,
  summary,
}: {
  attemptId: string;
  lessonTitle: string;
  summary: ContinueSummary;
}) {
  const { answered, total, secondsLeft } = summary;
  const time =
    secondsLeft === null
      ? t.noLimit
      : secondsLeft > 0
        ? t.timeLeft(formatClock(secondsLeft))
        : t.timeUp;
  return (
    <section
      aria-labelledby="continue-heading"
      className="flex flex-col gap-3 rounded-lg border border-primary bg-surface p-5 shadow-card"
    >
      <p className="font-semibold text-primary text-xs uppercase tracking-wide">
        {t.continueLabel}
      </p>
      <h2 id="continue-heading" className="break-words font-semibold text-lg">
        {lessonTitle}
      </h2>
      <p className="text-muted-foreground text-sm">
        <span className="font-mono tabular-nums">
          {answered}/{total}
        </span>{" "}
        {t.questions} · {time}
      </p>
      <Link
        href={`/attempts/${attemptId}`}
        className={buttonVariants({ size: "lg", className: "sm:self-start" })}
      >
        {t.continue}
        <ArrowRight aria-hidden className="size-5" />
      </Link>
    </section>
  );
}

/** Rating, last change, tier and a mini chart of the latest changes. */
export function RatingCard({
  rating,
  recent,
}: {
  rating: number | null;
  recent: readonly RatingPoint[];
}) {
  const last = recent.at(-1);
  const series = ratingSeries(recent);
  return (
    <section
      aria-labelledby="rating-heading"
      className="flex flex-col gap-3 rounded-lg border bg-surface p-5 shadow-card"
    >
      <h2
        id="rating-heading"
        className="font-medium text-muted-foreground text-sm"
      >
        {t.ratingHeading}
      </h2>
      {rating === null ? (
        <p className="text-sm">{t.noRating}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="font-mono font-semibold text-3xl tabular-nums">
              <span className="sr-only">{ratingCopy.label} </span>
              {formatRating(rating)}
            </p>
            {last && (
              <RatingDelta value={last.delta} label={t.lastChange} strong />
            )}
            <TierBadge rating={rating} />
          </div>
          {series.length > 1 && (
            <figure className="space-y-1">
              <RatingSparkline values={series} />
              <figcaption className="text-muted-foreground text-xs">
                {t.recentCaption(recent.length)}
              </figcaption>
            </figure>
          )}
        </>
      )}
    </section>
  );
}

/** The two shortcut tiles: open mistakes → /review, my rank → /leaderboard. */
export function StatTiles({
  openMistakes,
  rank,
  grade,
}: {
  openMistakes: number;
  rank: number | null;
  grade: number | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Tile
        href="/review"
        icon={<Repeat aria-hidden className="size-5" strokeWidth={1.75} />}
        title={openMistakes ? t.mistakes(openMistakes) : t.noMistakes}
        sub={openMistakes ? t.mistakesSub : t.noMistakesSub}
      />
      <Tile
        href={grade ? `/leaderboard?grade=${grade}` : "/leaderboard"}
        icon={<Trophy aria-hidden className="size-5" strokeWidth={1.75} />}
        title={rank ? t.rank(rank) : t.notRanked}
        sub={t.rankSub(grade)}
      />
    </div>
  );
}

function Tile({
  href,
  icon,
  title,
  sub,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-24 flex-col justify-between gap-2 rounded-lg border bg-surface p-4 shadow-card transition-colors hover:border-primary"
    >
      <span className="text-primary">{icon}</span>
      <span className="flex items-end justify-between gap-1">
        <span>
          <span className="block font-semibold">{title}</span>
          <span className="block text-muted-foreground text-sm">{sub}</span>
        </span>
        <ChevronRight
          aria-hidden
          className="size-5 shrink-0 text-muted-foreground group-hover:text-primary"
        />
      </span>
    </Link>
  );
}

export function DashboardCardsSkeleton() {
  return (
    <>
      <Skeleton className="h-36 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    </>
  );
}
