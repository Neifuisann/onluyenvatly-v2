import { School, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireStudent } from "@/features/auth/guards";
import { getStudentClasses } from "@/features/classes/queries";
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
 * `/leaderboard?class=&period=all|week` (05 §1, B-03): the viewer's
 * classmates only. One per-user read (the viewer's classes), then the
 * class's board from the cache shared by the class; the viewer's own row is
 * found in it, so no other per-user query.
 */
export default async function LeaderboardPage({
  searchParams,
}: PageProps<"/leaderboard">) {
  const user = await requireStudent();
  const params = parseLeaderboardParams(await searchParams);
  const classes = await getStudentClasses(user.id);
  // A class the viewer isn't in falls back to their first one.
  const current =
    classes.find((c) => c.id === params.classId) ?? classes[0] ?? null;
  if (!current)
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <h1 className="heading-page">{t.title}</h1>
        <EmptyState
          icon={School}
          title={t.noClassTitle}
          description={t.noClassBody}
          action={
            <Link href="/classes" className={buttonVariants()} prefetch={false}>
              {t.toClasses}
            </Link>
          }
        />
      </div>
    );
  const filters = { ...params, classId: current.id };
  const view = leaderboardView(await getLeaderboard(filters), user.id);
  const week = filters.period === "week";
  const lessonsHref = `/classes/${current.id}`;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="space-y-2">
        <h1 className="heading-page">{t.title}</h1>
        <p className="text-muted-foreground">
          {week ? t.leadWeek(current.name) : t.leadAll(current.name)}
        </p>
      </header>
      <LeaderboardFilters filters={filters} classes={classes} />
      {!view.me && view.shown.length > 0 && (
        <p className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary bg-primary-soft px-4 py-3 text-sm">
          {week ? t.notRankedWeek : t.notRankedAll}
          <Link
            href={lessonsHref}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
            prefetch={false}
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
            <Link
              href={lessonsHref}
              className={buttonVariants()}
              prefetch={false}
            >
              {t.findLesson}
            </Link>
          }
        />
      )}
    </div>
  );
}
