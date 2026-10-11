import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireTeacher } from "@/features/auth/guards";
import { QuestionStatsCard } from "@/features/lessons/components/stats/question-stats-card";
import {
  SortToggle,
  VersionPicker,
} from "@/features/lessons/components/stats/stats-controls";
import {
  ScoreHistogram,
  StatsSummary,
} from "@/features/lessons/components/stats/stats-summary";
import { editHref, LessonIdSchema } from "@/features/lessons/domain/admin-list";
import {
  chooseStatsVersion,
  parseStatsParams,
  STATS_ATTEMPT_CAP,
  sortQuestionStats,
  statsVersionOptions,
} from "@/features/lessons/domain/stats";
import { statsCopy as t } from "@/features/lessons/messages";
import {
  getLessonStats,
  getStatsLesson,
  getStatsVersions,
} from "@/features/lessons/stats-queries";

export const metadata: Metadata = { title: t.metaTitle };

/**
 * `/admin/lessons/[id]/stats?version=&sort=` (S6-05): one version's
 * statistics. The aggregates are shared-cached for 5 minutes (tag
 * `lesson:{id}:stats`); the header is one primary-key read.
 */
export default async function LessonStatsPage({
  params,
  searchParams,
}: PageProps<"/admin/lessons/[id]/stats">) {
  const user = await requireTeacher();
  const id = LessonIdSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const [lesson, withAttempts] = await Promise.all([
    getStatsLesson(user, id.data),
    getStatsVersions(id.data),
  ]);
  if (!lesson) notFound();
  const p = parseStatsParams(await searchParams);
  const versions = statsVersionOptions(withAttempts, lesson.current);
  const currentId = lesson.current?.id ?? null;
  const chosen = chooseStatsVersion(versions, p.version, currentId);
  const data =
    chosen && chosen.attempts > 0
      ? await getLessonStats(lesson.id, chosen.id, lesson.tfScoring)
      : null;
  const pinned = { ...p, version: chosen?.id ?? null };
  const byId = new Map(data?.questions.map((q) => [q.id, q]));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        back={{
          href: editHref(lesson.id, lesson.current !== null),
          label: t.back,
        }}
        title={t.title(lesson.title)}
        lead={t.lead}
      />

      {chosen && versions.length > 0 && (
        <VersionPicker
          lessonId={lesson.id}
          versions={versions}
          selected={chosen.id}
          currentId={currentId}
          sort={p.sort}
        />
      )}

      {data && data.stats.attempts > 0 ? (
        <>
          {data.capped && (
            <p role="note" className="rounded-md bg-muted p-3 text-sm">
              {t.capped(STATS_ATTEMPT_CAP)}
            </p>
          )}
          <StatsSummary stats={data.stats} />
          <ScoreHistogram distribution={data.stats.distribution} />
          <section
            aria-labelledby="questions-heading"
            className="flex flex-col gap-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="questions-heading" className="heading-section">
                {t.questions}
              </h2>
              <SortToggle lessonId={lesson.id} params={pinned} />
            </div>
            {sortQuestionStats(data.stats.questions, p.sort).map((entry) => {
              const question = byId.get(entry.id);
              return question ? (
                <QuestionStatsCard
                  key={entry.id}
                  entry={entry}
                  question={question}
                />
              ) : null;
            })}
          </section>
        </>
      ) : (
        <EmptyState
          mascot="graph"
          title={t.emptyTitle}
          description={t.emptyBody}
        />
      )}
    </div>
  );
}
