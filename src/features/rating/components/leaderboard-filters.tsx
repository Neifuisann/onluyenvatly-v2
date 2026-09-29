import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  type LeaderboardFilters as Filters,
  LEADERBOARD_PERIODS,
  leaderboardHref,
} from "../domain/leaderboard";
import { leaderboardCopy as t } from "../messages";

const GRADES = [null, 10, 11, 12] as const;

/**
 * Period switch + grade chips. Plain links (URL state, no client JS), like the
 * catalog's grade chips.
 */
export function LeaderboardFilters({ filters }: { filters: Filters }) {
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
      <ul
        aria-label={t.gradeGroup}
        className="flex w-fit rounded-full bg-muted p-1"
      >
        {GRADES.map((grade) => {
          const active = filters.grade === grade;
          return (
            <li key={grade ?? "all"}>
              <Link
                href={leaderboardHref(filters, { grade })}
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
                {grade ? t.grade(grade) : t.allGrades}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
