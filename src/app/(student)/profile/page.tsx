import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireStudent } from "@/features/auth/guards";
import {
  AccuracyBars,
  typeLabel,
} from "@/features/profile/components/accuracy-bars";
import { HistoryList } from "@/features/profile/components/history-list";
import { RatingChartLazy } from "@/features/profile/components/rating-chart-lazy";
import {
  ACCURACY_WINDOW,
  accuracyBreakdown,
  activeStreak,
  parseHistoryPage,
} from "@/features/profile/domain/profile";
import { profileCopy as t } from "@/features/profile/messages";
import {
  getAccuracy,
  getMyHistory,
  getProfileSummary,
  getRatingHistory,
} from "@/features/profile/queries";
import { TierBadge, TierEmblem } from "@/features/rating/components/tier-badge";
import { initials } from "@/features/rating/domain/leaderboard";
import { tierOf } from "@/features/rating/domain/rating";
import { formatRating } from "@/features/rating/messages";
import { formatScore, vnDateKey } from "@/lib/dates";

export const metadata: Metadata = { title: t.title };

/**
 * `/profile` (05 §1, 01 R7): overview, rating chart (Recharts, lazy), accuracy
 * by question type and chapter, and my history with "Xem thêm".
 */
export default async function ProfilePage({
  searchParams,
}: PageProps<"/profile">) {
  const user = await requireStudent();
  const page = parseHistoryPage(await searchParams);
  const [summary, ratingHistory, accuracyRows, history] = await Promise.all([
    getProfileSummary(user.id),
    getRatingHistory(user.id),
    getAccuracy(user.id),
    getMyHistory(user.id, page),
  ]);
  const { byType, byChapter } = accuracyBreakdown(accuracyRows);
  const streak = activeStreak(summary.activeDays, vnDateKey(new Date()));
  const first = ratingHistory[0];
  const last = ratingHistory.at(-1);
  const subtitle = [
    summary.className,
    user.grade ? t.gradeLabel(user.grade) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex items-center gap-4">
        <span
          aria-hidden
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary font-bold font-display text-primary-foreground text-xl sm:size-20 sm:text-2xl"
        >
          {initials(user.fullName)}
        </span>
        <div className="min-w-0">
          <h1 className="break-words heading-page">{user.fullName}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>
        {summary.rating !== null && (
          <TierEmblem
            tier={tierOf(summary.rating)}
            size={72}
            className="ml-auto hidden animate-pop sm:block"
          />
        )}
      </header>

      <section aria-label={t.overview}>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t.rating}>
            {summary.rating === null ? (
              t.noRating
            ) : (
              <span className="flex flex-col items-start gap-1.5">
                <Num>{formatRating(summary.rating)}</Num>
                <TierBadge rating={summary.rating} />
              </span>
            )}
            {summary.peak !== null && (
              <span className="mt-1 block font-normal text-muted-foreground text-xs">
                {t.peak(formatRating(summary.peak))}
              </span>
            )}
          </Stat>
          <Stat label={t.tests}>
            <Num>{summary.tests}</Num>
          </Stat>
          <Stat label={t.average}>
            <Num>
              {summary.average === null ? "–" : formatScore(summary.average)}
            </Num>
          </Stat>
          <Stat label={t.streak}>
            <Num>{streak}</Num>{" "}
            <span className="font-normal text-base">{t.days}</span>
          </Stat>
        </dl>
      </section>

      <section
        aria-labelledby="chart-heading"
        className="space-y-3 rounded-lg border border-border/70 bg-surface p-5 shadow-card sm:p-6 dark:border-border"
      >
        <h2 id="chart-heading" className="heading-section">
          {t.chartTitle}
        </h2>
        {first && last && ratingHistory.length > 1 ? (
          <figure className="space-y-2">
            <RatingChartLazy
              points={ratingHistory.map((p) => ({
                t: p.at.getTime(),
                r: p.rating,
              }))}
            />
            <figcaption className="text-muted-foreground text-sm">
              {t.chartSummary(
                formatRating(first.rating),
                formatRating(last.rating),
                ratingHistory.length,
              )}
            </figcaption>
          </figure>
        ) : (
          <p className="text-muted-foreground text-sm">{t.chartEmpty}</p>
        )}
      </section>

      <section
        aria-labelledby="accuracy-heading"
        className="space-y-4 rounded-lg border border-border/70 bg-surface p-5 shadow-card sm:p-6 dark:border-border"
      >
        <div className="space-y-1">
          <h2 id="accuracy-heading" className="heading-section">
            {t.accuracyTitle}
          </h2>
          <p className="text-muted-foreground text-sm">
            {byType.length ? t.accuracyLead(ACCURACY_WINDOW) : t.accuracyEmpty}
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <AccuracyBars title={t.byType} entries={byType} label={typeLabel} />
          <AccuracyBars title={t.byChapter} entries={byChapter} />
        </div>
      </section>

      <section
        aria-labelledby="history-heading"
        className="flex flex-col gap-3"
      >
        <h2 id="history-heading" className="heading-section">
          {t.historyTitle}
        </h2>
        {history.items.length ? (
          <HistoryList items={history.items} />
        ) : (
          <EmptyState
            mascot="laptop"
            title={t.historyEmptyTitle}
            description={t.historyEmptyBody}
            action={
              <Link href="/lessons" className={buttonVariants()}>
                {t.findLesson}
              </Link>
            }
          />
        )}
        {history.hasMore && (
          <Link
            href={`/profile?page=${page + 1}`}
            prefetch={false}
            scroll={false}
            className={buttonVariants({
              variant: "secondary",
              className: "self-center",
            })}
          >
            {t.loadMore}
          </Link>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-surface p-5 shadow-card dark:border-border">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="mt-1 font-display font-semibold text-2xl tracking-tight">
        {children}
      </dd>
    </div>
  );
}

const Num = ({ children }: { children: React.ReactNode }) => (
  <span className="num">{children}</span>
);
