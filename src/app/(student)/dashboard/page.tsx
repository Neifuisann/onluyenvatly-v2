import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireStudent } from "@/features/auth/guards";
import { getStudentClasses } from "@/features/classes/queries";
import {
  ContinueCard,
  NextLessonCard,
  RatingCard,
  StatTiles,
  WelcomeCard,
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
import { JoinBanner } from "@/features/games/components/join-banner";
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

/** Classes whose lessons feed the recommendations (the first ones by name). */
const RECOMMEND_CLASSES = 4;

/**
 * Student home (07 §5.1). Per-user: the session, `getDashboardStats`,
 * `getContinueAttempt` and the student's classes (4 queries). The rank (in
 * the first class) and the recommendations (lessons of their classes) come
 * from the per-class shared leaderboard and catalog caches (B-03).
 */
export default async function DashboardPage() {
  const user = await requireStudent();
  const [stats, open, classes] = await Promise.all([
    getDashboardStats(user.id),
    getContinueAttempt(user.id),
    getStudentClasses(user.id),
  ]);
  const home = classes[0] ?? null;
  const [board, ...catalogs] = await Promise.all([
    home ? getLeaderboard({ classId: home.id, period: "all" }) : [],
    // Each class's lessons in the teacher's order; cached per class.
    ...classes
      .slice(0, RECOMMEND_CLASSES)
      .map((c) => getCatalog(c.id, { ...DEFAULT_FILTERS, page: MAX_PAGE })),
  ]);
  const seen = new Set<number>();
  const lessons = catalogs
    .flatMap((c) => c.items)
    .filter((l) => !seen.has(l.id) && seen.add(l.id));
  const rank = leaderboardView(board, user.id).me?.rank ?? null;
  // The test in progress already has its own card.
  const recommended = recommendLessons(
    lessons,
    [...stats.doneLessonIds, ...(open ? [open.lessonId] : [])],
    user.grade,
  );
  const firstName = user.fullName.trim().split(/\s+/).at(-1) ?? "";
  // Nothing in progress: the first recommendation becomes the one big action.
  const featured = open ? null : (recommended[0] ?? null);
  const others = featured ? recommended.slice(1) : recommended;
  // Nothing done yet: explain how the site works (it goes away after one test).
  const firstVisit =
    !open && stats.rating === null && stats.doneLessonIds.length === 0;
  const lead = open
    ? t.leadContinue
    : stats.openMistakes
      ? t.leadMistakes(stats.openMistakes)
      : firstVisit
        ? t.leadWelcome
        : t.leadDefault;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:gap-8">
      <header className="space-y-1">
        <h1 className="heading-page">{shellCopy.greeting(firstName)}</h1>
        <p className="text-muted-foreground sm:text-lg">{lead}</p>
      </header>
      {firstVisit && <WelcomeCard />}
      {open && (
        <ContinueCard
          attemptId={open.id}
          lessonTitle={open.lessonTitle}
          summary={continueSummary(open.answers, open.deadlineAt, new Date())}
        />
      )}
      <div className="grid animate-rise grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <div className="col-span-2 flex lg:col-span-1 [&>*]:flex-1">
          <RatingCard rating={stats.rating} recent={stats.recent} />
        </div>
        <StatTiles
          openMistakes={stats.openMistakes}
          rank={rank}
          className={home?.name ?? null}
        />
      </div>
      <JoinBanner />
      <section aria-labelledby="recommended-heading" className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="recommended-heading" className="heading-section">
            {t.recommended}
          </h2>
          <Link
            href="/classes"
            prefetch={false}
            className="shrink-0 font-semibold text-primary text-sm hover:underline"
          >
            {t.seeAll}
          </Link>
        </div>
        {recommended.length ? (
          <>
            {featured && <NextLessonCard lesson={featured} />}
            {others.length > 0 && (
              <div className={cardGridClass}>
                {others.map((lesson) => (
                  <LessonCard key={lesson.id} lesson={lesson} />
                ))}
              </div>
            )}
          </>
        ) : lessons.length ? (
          <EmptyState
            mascot="all-clear"
            title={t.allDoneTitle}
            description={t.allDoneBody}
            action={
              <Link
                href="/classes"
                className={buttonVariants({ variant: "secondary" })}
                prefetch={false}
              >
                {t.seeAll}
              </Link>
            }
          />
        ) : (
          <EmptyState
            mascot={classes.length ? "studying" : "waiting"}
            title={classes.length ? t.noLessonsTitle : t.noClassTitle}
            description={classes.length ? t.noLessonsBody : t.noClassBody}
            action={
              classes.length ? undefined : (
                <Link
                  href="/classes"
                  className={buttonVariants({ variant: "secondary" })}
                  prefetch={false}
                >
                  {t.seeClasses}
                </Link>
              )
            }
          />
        )}
      </section>
    </div>
  );
}
