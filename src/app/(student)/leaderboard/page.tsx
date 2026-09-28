import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireStudent } from "@/features/auth/guards";
import { LeaderboardFilters } from "@/features/rating/components/leaderboard-filters";
import { LeaderboardList } from "@/features/rating/components/leaderboard-list";
import {
  leaderboardView,
  parseLeaderboardParams,
} from "@/features/rating/domain/leaderboard";
import { leaderboardCopy as t } from "@/features/rating/messages";
import { getLeaderboard } from "@/features/rating/queries";

export const metadata: Metadata = { title: t.title };

/**
 * `/leaderboard?grade=&period=all|week` (05 §1). One cached read shared by
 * every student; the viewer's own row is found in it, so no per-user query.
 */
export default async function LeaderboardPage({
  searchParams,
}: PageProps<"/leaderboard">) {
  const user = await requireStudent();
  const filters = parseLeaderboardParams(await searchParams);
  const view = leaderboardView(await getLeaderboard(filters), user.id);
  const week = filters.period === "week";
  // Nudge only on a board the student could appear on.
  const showNotRanked =
    !view.me && (filters.grade === null || filters.grade === user.grade);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="space-y-2">
        <h1 className="font-semibold text-2xl">{t.title}</h1>
        <p className="text-muted-foreground">{week ? t.leadWeek : t.leadAll}</p>
      </header>
      <LeaderboardFilters filters={filters} />
      {showNotRanked && view.shown.length > 0 && (
        <p className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary bg-primary-soft px-4 py-3 text-sm">
          {week ? t.notRankedWeek : t.notRankedAll}
          <Link
            href="/lessons"
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            {t.findLesson}
          </Link>
        </p>
      )}
      {view.shown.length ? (
        <LeaderboardList view={view} period={filters.period} />
      ) : (
        <EmptyState
          icon={Trophy}
          title={week ? t.emptyWeekTitle : t.emptyAllTitle}
          description={week ? t.emptyWeekBody : t.emptyAllBody}
          action={
            <Link href="/lessons" className={buttonVariants()}>
              {t.findLesson}
            </Link>
          }
        />
      )}
    </div>
  );
}
