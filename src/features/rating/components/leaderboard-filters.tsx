import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  type LeaderboardFilters as Filters,
  LEADERBOARD_PERIODS,
  leaderboardHref,
} from "../domain/leaderboard";
import { leaderboardCopy as t } from "../messages";

/**
 * Period switch + class chips (B-03: the student's own classes). Plain links
 * (URL state, no client JS), like the catalog's chips.
 */
export function LeaderboardFilters({
  filters,
  classes,
}: {
  /** `classId` is the class shown. */
  filters: Filters;
  classes: readonly { id: number; name: string }[];
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <ul
        aria-label={t.periodGroup}
        className="grid grid-cols-2 rounded-full bg-muted p-1 sm:inline-grid"
      >
        {LEADERBOARD_PERIODS.map((period) => {
          const active = filters.period === period;
          return (
            <li key={period}>
              <Link
                href={leaderboardHref(filters, { period })}
                prefetch={false}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center justify-center rounded-full px-5 font-medium text-sm transition-[background-color,color,box-shadow]",
                  active
                    ? "bg-surface text-foreground shadow-card"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.periods[period]}
              </Link>
            </li>
          );
        })}
      </ul>
      {classes.length > 1 && (
        <ul
          aria-label={t.classGroup}
          className="flex w-fit max-w-full flex-wrap gap-1 rounded-3xl bg-muted p-1"
        >
          {classes.map((c) => {
            const active = filters.classId === c.id;
            return (
              <li key={c.id}>
                <Link
                  href={leaderboardHref(filters, { classId: c.id })}
                  prefetch={false}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-10 items-center rounded-full px-3.5 font-medium text-sm transition-[background-color,color,box-shadow]",
                    active
                      ? "bg-surface text-foreground shadow-card"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c.name}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
