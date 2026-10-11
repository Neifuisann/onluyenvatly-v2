import {
  ArrowRight,
  ChevronRight,
  Clock,
  ListChecks,
  Repeat,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { Mascot } from "@/components/mascot";
import { buttonVariants } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { catalogCopy, formatDuration } from "@/features/lessons/messages";
import type { CatalogItem } from "@/features/lessons/queries";
import { RatingDelta } from "@/features/rating/components/rating-delta";
import { RatingSparkline } from "@/features/rating/components/rating-sparkline";
import { TierBadge, TierEmblem } from "@/features/rating/components/tier-badge";
import { tierOf } from "@/features/rating/domain/rating";
import { ratingSeries } from "@/features/rating/domain/sparkline";
import { formatRating, ratingCopy } from "@/features/rating/messages";
import { formatClock } from "@/lib/dates";
import { onboardingCopy } from "@/lib/messages";
import { cn } from "@/lib/utils";
import type { ContinueSummary } from "../domain/dashboard";
import { dashboardCopy as t } from "../messages";
import type { RatingPoint } from "../queries";

/** The navy hero surface shared by "continue" and "next lesson". */
const heroClass =
  "relative isolate overflow-hidden rounded-xl bg-ink p-5 text-ink-foreground shadow-raised sm:p-7";

/** A soft lagoon glow in the hero's corner: depth without decoration. */
function HeroGlow() {
  return (
    <span
      aria-hidden
      className="-z-10 -right-24 -top-24 absolute size-72 rounded-full bg-primary/35 blur-3xl"
    />
  );
}

/** "Đang làm dở": the test I left, with its progress and a big resume button (07 §5.1). */
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
  const pct = total ? Math.round((answered / total) * 100) : 0;
  return (
    <section
      aria-labelledby="continue-heading"
      className={cn(heroClass, "animate-rise")}
    >
      <HeroGlow />
      <div className="flex items-end gap-4">
        <div className="min-w-0 flex-1 space-y-4">
          <p className="eyebrow inline-flex items-center gap-2 text-ink-muted">
            <span aria-hidden className="size-2 rounded-full bg-accent" />
            {t.continueLabel}
          </p>
          <h2
            id="continue-heading"
            className="break-words font-display font-semibold text-2xl leading-tight tracking-tight sm:text-[1.75rem]"
          >
            {lessonTitle}
          </h2>
          <div className="max-w-md space-y-2">
            <div
              aria-hidden
              className="h-2 overflow-hidden rounded-full bg-ink-foreground/15"
            >
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-ink-muted text-sm">
              <span className="num font-semibold text-ink-foreground">
                {answered}/{total}
              </span>{" "}
              {t.questions} · {time}
            </p>
          </div>
          <Link
            href={`/attempts/${attemptId}`}
            className={buttonVariants({ variant: "ink", size: "lg" })}
            prefetch={false}
          >
            {t.continue}
            <ArrowRight aria-hidden />
          </Link>
        </div>
        <Mascot
          pose="laptop"
          size={150}
          priority
          className="-mb-2 hidden shrink-0 sm:block"
        />
      </div>
    </section>
  );
}

/**
 * First visit (no attempt yet): how the site works in three steps. It needs
 * no dismiss button or storage; it goes away after the first test.
 */
export function WelcomeCard() {
  return (
    <section
      aria-labelledby="welcome-heading"
      className={cn(
        cardClass,
        "flex animate-rise items-center gap-6 p-5 sm:p-7",
      )}
    >
      <div className="min-w-0 flex-1 space-y-4">
        <div className="space-y-1">
          <h2 id="welcome-heading" className="heading-section">
            {onboardingCopy.welcomeTitle}
          </h2>
          <p className="text-muted-foreground">{onboardingCopy.welcomeLead}</p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-3">
          {onboardingCopy.welcomeSteps.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="num flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold font-display text-primary-foreground text-sm">
                {i + 1}
              </span>
              <span>
                <span className="block font-semibold">{step.title}</span>
                <span className="block text-muted-foreground text-sm">
                  {step.body}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <Mascot pose="teacher" size={140} className="hidden shrink-0 md:block" />
    </section>
  );
}

/** The first recommendation, featured when nothing is in progress. */
export function NextLessonCard({ lesson }: { lesson: CatalogItem }) {
  return (
    <Link
      href={`/lessons/${lesson.id}`}
      prefetch={false}
      className={cn(
        heroClass,
        "group flex items-end gap-4 transition-transform duration-200 hover:-translate-y-0.5",
      )}
    >
      <HeroGlow />
      <div className="min-w-0 flex-1 space-y-3">
        <p className="eyebrow inline-flex items-center gap-2 text-ink-muted">
          <span aria-hidden className="size-2 rounded-full bg-accent" />
          {t.nextLesson}
        </p>
        <h3 className="break-words font-display font-semibold text-2xl leading-tight tracking-tight sm:text-[1.75rem]">
          {lesson.title}
        </h3>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-muted text-sm">
          {lesson.chapter && <span>{lesson.chapter}</span>}
          <span className="inline-flex items-center gap-1.5">
            <ListChecks aria-hidden className="size-4" strokeWidth={1.75} />
            {catalogCopy.questions(lesson.questionCount)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock aria-hidden className="size-4" strokeWidth={1.75} />
            {lesson.timeLimitSec
              ? formatDuration(lesson.timeLimitSec)
              : catalogCopy.noTimeLimit}
          </span>
        </p>
        <span
          className={buttonVariants({
            variant: "ink",
            size: "lg",
            className: "mt-1",
          })}
        >
          {t.openLesson}
          <ArrowRight
            aria-hidden
            className="transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </div>
      <Mascot
        pose="studying"
        size={170}
        className="-mb-2 hidden shrink-0 sm:block"
      />
    </Link>
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
      className={cn(cardClass, "flex flex-col gap-3 p-5")}
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="rating-heading"
          className="font-semibold text-muted-foreground text-sm"
        >
          {t.ratingHeading}
        </h2>
        {rating !== null && <TierBadge rating={rating} />}
      </div>
      {rating === null ? (
        <p className="text-sm">{t.noRating}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="num font-bold font-display text-[2.5rem] leading-none tracking-tight">
              <span className="sr-only">{ratingCopy.label} </span>
              {formatRating(rating)}
            </p>
            {last && (
              <RatingDelta value={last.delta} label={t.lastChange} strong />
            )}
            <TierEmblem
              tier={tierOf(rating)}
              size={52}
              className="ml-auto animate-pop"
            />
          </div>
          {series.length > 1 && (
            <figure className="mt-auto space-y-1">
              <RatingSparkline values={series} className="h-12" />
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
  className,
}: {
  openMistakes: number;
  rank: number | null;
  /** The class the rank is in (B-03); null without a class. */
  className: string | null;
}) {
  return (
    <>
      <Tile
        href="/review"
        tone="bg-accent-soft text-accent-text"
        icon={<Repeat aria-hidden className="size-5" strokeWidth={2} />}
        title={openMistakes ? t.mistakes(openMistakes) : t.noMistakes}
        sub={openMistakes ? t.mistakesSub : t.noMistakesSub}
      />
      <Tile
        href="/leaderboard"
        tone="bg-primary-soft text-primary"
        icon={<Trophy aria-hidden className="size-5" strokeWidth={2} />}
        title={rank ? t.rank(rank) : t.notRanked}
        sub={t.rankSub(className)}
      />
    </>
  );
}

function Tile({
  href,
  tone,
  icon,
  title,
  sub,
}: {
  href: string;
  tone: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        cardClass,
        "group flex min-h-32 flex-col justify-between gap-4 p-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raised",
      )}
      prefetch={false}
    >
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-full",
          tone,
        )}
      >
        {icon}
      </span>
      <span className="flex items-end justify-between gap-1">
        <span>
          <span className="block font-display font-semibold text-xl leading-tight tracking-tight">
            {title}
          </span>
          <span className="mt-0.5 block text-muted-foreground text-sm">
            {sub}
          </span>
        </span>
        <ChevronRight
          aria-hidden
          className="size-5 shrink-0 text-muted-foreground transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-primary"
        />
      </span>
    </Link>
  );
}

export function DashboardCardsSkeleton() {
  return (
    <>
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-40 rounded-lg sm:col-span-2 lg:col-span-1" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    </>
  );
}
