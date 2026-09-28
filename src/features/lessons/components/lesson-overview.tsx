import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { MathText } from "@/components/math-text/math-text";
import {
  catalogCopy,
  formatDuration,
  questionTypeLabels,
  overviewCopy as t,
} from "../messages";
import type { LessonOverview } from "../queries";

export function LessonOverviewContent({
  lesson,
  attempts,
}: {
  lesson: LessonOverview;
  /** The per-user start/continue panel, streamed by the page. */
  attempts?: ReactNode;
}) {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link
        href="/lessons"
        className="inline-flex w-fit items-center gap-2 text-primary text-sm"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t.back}
      </Link>
      <header className="space-y-3">
        {lesson.status !== "published" && (
          <p className="font-medium text-warning-text">{t.unpublished}</p>
        )}
        <div className="flex flex-wrap gap-2 text-muted-foreground text-sm">
          {lesson.grade && <span>{catalogCopy.grade(lesson.grade)}</span>}
          {lesson.chapter && <span>{lesson.chapter}</span>}
        </div>
        <h1 className="break-words font-semibold text-2xl sm:text-3xl">
          {lesson.title}
        </h1>
        {lesson.description && <MathText text={lesson.description} />}
        {lesson.tags.length > 0 && (
          <ul aria-label={catalogCopy.tag} className="flex flex-wrap gap-2">
            {lesson.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-muted px-3 py-1 text-muted-foreground text-sm"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
      </header>
      <section className="rounded-lg border bg-surface p-5 shadow-card">
        <h2 className="font-semibold text-lg">{t.structure}</h2>
        <p className="mt-2 font-mono text-2xl">
          {catalogCopy.questions(lesson.questionCount)}
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          {(["mcq", "tf", "short"] as const).map((type) => (
            <div key={type} className="rounded-md bg-muted p-3">
              <dt className="text-muted-foreground text-sm">
                {questionTypeLabels[type]}
              </dt>
              <dd className="mt-1 font-mono text-lg">
                {lesson.typeCounts[type] ?? 0}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="space-y-4 rounded-lg border bg-surface p-5 shadow-card">
        <h2 className="font-semibold text-lg">{t.rules}</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-sm">{t.duration}</dt>
            <dd className="mt-1 font-medium">
              {lesson.timeLimitSec
                ? formatDuration(lesson.timeLimitSec)
                : catalogCopy.noTimeLimit}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm">{t.attempts}</dt>
            <dd className="mt-1 font-medium">
              {lesson.maxAttempts ?? t.unlimited}
            </dd>
          </div>
        </dl>
        <p className="text-sm">
          {lesson.countsForRating ? t.rating : t.practice}
        </p>
        {lesson.examGuard && (
          <p className="flex items-start gap-2 text-muted-foreground text-sm">
            <ShieldCheck aria-hidden className="size-5 shrink-0" />
            {t.guard}
          </p>
        )}
      </section>
      {attempts}
    </article>
  );
}
