import { ChartColumn, PenLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  getLessonStudents,
  LESSON_STUDENTS_LIMIT,
} from "@/features/attempts/admin-queries";
import { LessonStudents } from "@/features/attempts/components/admin/lesson-students";
import { summarizeStudents } from "@/features/attempts/domain/lesson-results";
import { lessonResultsCopy as t } from "@/features/attempts/messages";
import { requireTeacher } from "@/features/auth/guards";
import { editHref, LessonIdSchema } from "@/features/lessons/domain/admin-list";
import { getStatsLesson } from "@/features/lessons/stats-queries";
import { formatClock, formatDateTime, formatScore } from "@/lib/dates";

export const metadata: Metadata = { title: t.metaTitle };

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/70 bg-surface p-4 shadow-card dark:border-border">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="num font-semibold text-2xl tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * `/admin/lessons/[id]/results`: who submitted this lesson (Azota's "Danh
 * sách đã thi"), one card per student; each opens their tries. Per request
 * and uncached, like `/admin/results`: a deleted attempt goes at once.
 */
export default async function LessonResultsPage({
  params,
}: PageProps<"/admin/lessons/[id]/results">) {
  const user = await requireTeacher();
  const id = LessonIdSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const [lesson, rows] = await Promise.all([
    getStatsLesson(user, id.data),
    getLessonStudents(id.data),
  ]);
  if (!lesson) notFound();
  const summary = summarizeStudents(rows);
  const actionClass = buttonVariants({ variant: "secondary" });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        back={{ href: "/admin/lessons", label: t.back }}
        title={t.title(lesson.title)}
        lead={t.lead}
        actions={
          <>
            <Link
              href={`/admin/lessons/${lesson.id}/stats`}
              prefetch={false}
              className={actionClass}
            >
              <ChartColumn aria-hidden />
              {t.stats}
            </Link>
            <Link
              href={editHref(lesson.id, lesson.current !== null)}
              prefetch={false}
              className={actionClass}
            >
              <PenLine aria-hidden />
              {t.edit}
            </Link>
          </>
        }
      />
      {rows.length ? (
        <>
          <dl
            aria-label={t.summaryLabel}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
          >
            <Tile label={t.students} value={String(summary.students)} />
            <Tile label={t.attempts} value={String(summary.attempts)} />
            <Tile
              label={t.average}
              value={
                summary.average === null ? "–" : formatScore(summary.average)
              }
            />
            <Tile label={t.passed} value={String(summary.passed)} />
            <Tile label={t.low} value={String(summary.low)} />
          </dl>
          {rows.length >= LESSON_STUDENTS_LIMIT && (
            <p role="note" className="rounded-md bg-muted p-3 text-sm">
              {t.limited(LESSON_STUDENTS_LIMIT)}
            </p>
          )}
          <LessonStudents
            lessonId={lesson.id}
            rows={rows.map((r) => ({
              ...r,
              time:
                r.latestTimeTakenSec === null
                  ? null
                  : formatClock(r.latestTimeTakenSec),
              submitted: r.latestSubmittedAt
                ? formatDateTime(r.latestSubmittedAt)
                : null,
            }))}
          />
        </>
      ) : (
        <EmptyState
          mascot="laptop"
          title={t.emptyTitle}
          description={t.emptyBody}
        />
      )}
    </div>
  );
}
