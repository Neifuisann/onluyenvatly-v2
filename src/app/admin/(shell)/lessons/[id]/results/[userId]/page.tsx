import { ArrowRight, ShieldAlert, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { getLessonStudentAttempts } from "@/features/attempts/admin-queries";
import {
  resultsCopy,
  lessonResultsCopy as t,
} from "@/features/attempts/messages";
import { requireAdmin } from "@/features/auth/guards";
import { LessonIdSchema } from "@/features/lessons/domain/admin-list";
import { getStatsLesson } from "@/features/lessons/stats-queries";
import { StudentIdSchema } from "@/features/students/domain/input";
import { formatClock, formatDateTime, formatScore } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: t.studentMeta };

function scoreTone(score: number | null) {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score >= 8) return "bg-success-soft text-success-text";
  if (score >= 5) return "bg-accent-soft text-accent-text";
  return "bg-danger-soft text-danger-text";
}

/**
 * `/admin/lessons/[id]/results/[userId]`: one student's tries of a lesson,
 * try 1 first. Each finished try opens its result page, where the teacher
 * sees every answer, the exam-guard timeline and "Xóa bài làm".
 */
export default async function LessonStudentPage({
  params,
}: PageProps<"/admin/lessons/[id]/results/[userId]">) {
  await requireAdmin();
  const raw = await params;
  const id = LessonIdSchema.safeParse(raw.id);
  const userId = StudentIdSchema.safeParse(raw.userId);
  if (!id.success || !userId.success) notFound();
  const [lesson, data] = await Promise.all([
    getStatsLesson(id.data),
    getLessonStudentAttempts(id.data, userId.data),
  ]);
  if (!lesson || !data) notFound();
  const { student, attempts } = data;
  const klass = resultsCopy.class(student.className, student.grade);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        back={{
          href: `/admin/lessons/${lesson.id}/results`,
          label: t.studentBack,
        }}
        title={student.fullName}
        badges={
          klass && (
            <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground text-sm">
              {klass}
            </span>
          )
        }
        lead={t.studentLead(lesson.title)}
        actions={
          <Link
            href={`/admin/students/${student.id}`}
            prefetch={false}
            className={buttonVariants({ variant: "secondary" })}
          >
            <UserRound aria-hidden />
            {t.profile}
          </Link>
        }
      />
      {attempts.length ? (
        <ol aria-label={t.triesLabel} className="flex flex-col gap-3">
          {attempts.map((a, i) => {
            const n = i + 1;
            const open = a.status !== "in_progress";
            return (
              <li
                key={a.id}
                className={cn(
                  cardClass,
                  "flex flex-wrap items-center gap-4 p-4",
                )}
              >
                <span
                  className={cn(
                    "num flex size-16 shrink-0 flex-col items-center justify-center rounded-full font-bold font-display text-xl leading-none",
                    scoreTone(a.score10),
                  )}
                >
                  <span className="sr-only">{resultsCopy.score} </span>
                  {a.score10 === null ? "–" : formatScore(a.score10)}
                </span>
                <div className="min-w-0 flex-1 basis-48 space-y-1">
                  <h2 className="flex flex-wrap items-center gap-2 font-semibold">
                    {t.tryHeading(n)}
                    {a.status !== "submitted" && (
                      <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
                        {a.status === "in_progress" ? t.inProgress : t.expired}
                      </span>
                    )}
                    {a.guardCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 font-semibold text-accent-text text-xs">
                        <ShieldAlert aria-hidden className="size-3.5" />
                        {t.guardBadge(a.guardCount)}
                      </span>
                    )}
                  </h2>
                  <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground text-sm">
                    {a.score !== null && (
                      <span className="num">
                        {t.outOf(formatScore(a.score), formatScore(a.maxScore))}
                      </span>
                    )}
                    {a.timeTakenSec !== null && (
                      <span>{t.time(formatClock(a.timeTakenSec))}</span>
                    )}
                    <span>
                      {a.submittedAt
                        ? t.submitted(formatDateTime(a.submittedAt))
                        : t.started(formatDateTime(a.startedAt))}
                    </span>
                  </p>
                </div>
                {open && (
                  <Link
                    href={`/attempts/${a.id}/result`}
                    prefetch={false}
                    aria-label={t.viewLabel(n)}
                    className={buttonVariants({
                      variant: "secondary",
                      className: "shrink-0",
                    })}
                  >
                    {t.view}
                    <ArrowRight aria-hidden />
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-lg bg-muted p-5 text-muted-foreground text-sm">
          {t.noTries}
        </p>
      )}
    </div>
  );
}
