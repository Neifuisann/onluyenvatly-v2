import { BookOpen, PartyPopper } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireStudent } from "@/features/auth/guards";
import {
  ContinueCard,
  RatingCard,
  StatTiles,
} from "@/features/dashboard/components/dashboard-cards";
import {
  continueSummary,
  recommendLessons,
} from "@/features/dashboard/domain/dashboard";
import { dashboardCopy as t } from "@/features/dashboard/messages";
import {
  getContinueAttempt,
  getDashboardStats,
} from "@/features/dashboard/queries";
import {
  cardGridClass,
  LessonCard,
} from "@/features/lessons/components/lesson-card";
import { DEFAULT_FILTERS, MAX_PAGE } from "@/features/lessons/domain/catalog";
import { getCatalog } from "@/features/lessons/queries";
import { leaderboardView } from "@/features/rating/domain/leaderboard";
import { getLeaderboard } from "@/features/rating/queries";
import { shellCopy } from "@/lib/messages";

export const metadata: Metadata = { title: shellCopy.studentNav.dashboard };

/**
 * Student home (07 §5.1). Per-user: the session, `getDashboardStats` and
 * `getContinueAttempt` (3 queries). The rank and the recommendations come
 * from the shared leaderboard and catalog caches.
 */
export default async function DashboardPage() {
  const user = await requireStudent();
  const grade =
    user.grade === 10 || user.grade === 11 || user.grade === 12
      ? user.grade
      : null;
  const [stats, open, board, catalog] = await Promise.all([
    getDashboardStats(user.id),
    getContinueAttempt(user.id),
    getLeaderboard({ grade, period: "all" }),
    // Every lesson of my grade in the teacher's order; cached for all students.
    getCatalog({ ...DEFAULT_FILTERS, grade, page: MAX_PAGE }),
  ]);
  const rank = leaderboardView(board, user.id).me?.rank ?? null;
  // The test in progress already has its own card.
  const recommended = recommendLessons(catalog.items, [
    ...stats.doneLessonIds,
    ...(open ? [open.lessonId] : []),
  ]);
  const firstName = user.fullName.trim().split(/\s+/).at(-1) ?? "";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <h1 className="font-semibold text-2xl">
        {shellCopy.greeting(firstName)}
      </h1>
      {open && (
        <ContinueCard
          attemptId={open.id}
          lessonTitle={open.lessonTitle}
          summary={continueSummary(open.answers, open.deadlineAt, new Date())}
        />
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <RatingCard rating={stats.rating} recent={stats.recent} />
        <StatTiles
          openMistakes={stats.openMistakes}
          rank={rank}
          grade={grade}
        />
      </div>
      <section aria-labelledby="recommended-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="recommended-heading" className="font-semibold text-lg">
            {t.recommended}
          </h2>
          <Link
            href={grade ? `/lessons?grade=${grade}` : "/lessons"}
            prefetch={false}
            className="text-primary text-sm hover:underline"
          >
            {t.seeAll}
          </Link>
        </div>
        {recommended.length ? (
          <div className={cardGridClass}>
            {recommended.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} />
            ))}
          </div>
        ) : catalog.items.length ? (
          <EmptyState
            icon={PartyPopper}
            title={t.allDoneTitle}
            description={t.allDoneBody}
            action={
              <Link
                href="/lessons"
                className={buttonVariants({ variant: "secondary" })}
              >
                {t.seeAll}
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={BookOpen}
            title={t.noLessonsTitle}
            description={t.noLessonsBody}
          />
        )}
      </section>
    </div>
  );
}
