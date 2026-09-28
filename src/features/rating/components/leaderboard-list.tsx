import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  initials,
  type LeaderboardPeriod,
  type LeaderboardView,
  type RankedEntry,
} from "../domain/leaderboard";
import { formatRating, ratingCopy, leaderboardCopy as t } from "../messages";
import { RatingDelta } from "./rating-delta";
import { TierBadge } from "./tier-badge";

/**
 * `LeaderboardTable` of 07 §4 as a list of rows, which fits 360 px. The
 * viewer's row is sticky: it stays in its place while visible and pins to the
 * top or bottom edge (above the mobile tabs) once scrolled away. CSS only.
 */
export function LeaderboardList({
  view,
  period,
}: {
  view: LeaderboardView;
  period: LeaderboardPeriod;
}) {
  const { shown, me, meBelow } = view;
  return (
    <ol aria-label={t.listLabel} className="flex flex-col gap-1.5">
      {shown.map((row) => (
        <Row
          key={row.userId}
          row={row}
          period={period}
          isMe={row.userId === me?.userId}
        />
      ))}
      {me && meBelow && (
        <>
          <li
            aria-hidden
            className="py-1 text-center text-muted-foreground leading-none"
          >
            ⋮
          </li>
          <Row row={me} period={period} isMe />
        </>
      )}
    </ol>
  );
}

function Row({
  row,
  period,
  isMe,
}: {
  row: RankedEntry;
  period: LeaderboardPeriod;
  isMe: boolean;
}) {
  const byWeek = period === "week";
  return (
    <li
      className={cn(
        "grid grid-cols-[2.25rem_2.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-surface px-3 py-2.5",
        isMe &&
          "sticky top-[4.25rem] bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 border-primary bg-primary-soft shadow-card lg:top-4 lg:bottom-4",
      )}
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-full font-mono font-semibold tabular-nums",
          row.rank <= 3 ? "bg-accent text-accent-foreground" : "text-sm",
        )}
      >
        <span className="sr-only">{t.rank(row.rank)}</span>
        <span aria-hidden>{row.rank}</span>
      </span>
      <span
        aria-hidden
        className="flex size-9 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground text-xs"
      >
        {initials(row.fullName)}
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium">{row.fullName}</p>
        {/* The "Bạn" chip sits here so it never truncates the name at 360 px. */}
        <p className="mt-0.5 flex items-center gap-2 text-muted-foreground text-xs">
          {isMe && (
            <span className="shrink-0 rounded-full bg-primary px-2 font-medium text-primary-foreground">
              {t.me}
            </span>
          )}
          {row.className && <span>{row.className}</span>}
          <TierBadge rating={row.rating} className="px-2 py-0" />
        </p>
      </div>
      <div className="flex flex-col items-end gap-0.5 text-right">
        {byWeek ? (
          <>
            <RatingDelta value={row.weekDelta} label={t.weekChange} strong />
            <RatingValue rating={row.rating} />
          </>
        ) : (
          <>
            <RatingValue rating={row.rating} strong />
            <RatingDelta value={row.weekDelta} label={t.weekChange} />
          </>
        )}
      </div>
    </li>
  );
}

function RatingValue({ rating, strong }: { rating: number; strong?: boolean }) {
  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        strong ? "font-semibold" : "text-muted-foreground text-xs",
      )}
    >
      <span className="sr-only">{ratingCopy.label} </span>
      {formatRating(rating)}
    </span>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      {["a", "b", "c", "d", "e", "f", "g", "h"].map((key) => (
        <Skeleton key={key} className="h-[3.75rem] w-full rounded-lg" />
      ))}
    </div>
  );
}
