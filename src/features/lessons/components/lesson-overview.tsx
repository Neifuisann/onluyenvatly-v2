import {
  ChevronLeft,
  Clock,
  Dumbbell,
  ListChecks,
  type LucideIcon,
  Repeat,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { MathText } from "@/components/math-text/math-text";
import { cardClass } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { lessonTopic } from "../domain/topic";
import {
  catalogCopy,
  formatDuration,
  questionTypeLabels,
  overviewCopy as t,
} from "../messages";
import type { LessonOverview } from "../queries";
import { TopicGlyph } from "./topic-glyph";

const TYPES = ["mcq", "tf", "short"] as const;
/** One fill per question type; the legend always carries the name and count. */
const TYPE_FILL = {
  mcq: "bg-primary",
  tf: "bg-accent",
  short: "bg-ink dark:bg-peach",
} as const;

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <li className={cn(cardClass, "flex flex-col gap-3 p-4")}>
      <Icon aria-hidden className="size-5 text-primary" strokeWidth={2} />
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="font-display font-semibold text-base leading-tight tracking-tight sm:text-lg">
          {value}
        </p>
      </div>
    </li>
  );
}

/**
 * The lesson page (07 §5.2 entry): what the test is on the left, how to take
 * it on the right. On phones the "Làm bài" card follows the facts, so the
 * start button is reached without scrolling past the structure.
 */
export function LessonOverviewContent({
  lesson,
  attempts,
}: {
  lesson: LessonOverview;
  /** The per-user start/continue panel, streamed by the page. */
  attempts?: ReactNode;
}) {
  const total = lesson.questionCount;
  return (
    <article className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-x-10">
      <Link
        href="/lessons"
        className="-ml-2 inline-flex min-h-11 lg:col-start-1 w-fit items-center gap-1 rounded-full pr-3 pl-1.5 font-medium text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft aria-hidden className="size-5" />
        {t.back}
      </Link>
      <header className="min-w-0 animate-rise space-y-4 lg:col-start-1">
        {lesson.status !== "published" && (
          <p className="inline-flex rounded-full bg-accent-soft px-3 py-1 font-semibold text-accent-text text-sm">
            {t.unpublished}
          </p>
        )}
        <div className="flex items-center gap-3">
          <TopicGlyph
            topic={lessonTopic(lesson.chapter, lesson.title)}
            className="size-14 rounded-2xl [&>svg]:size-7"
          />
          <p className="text-muted-foreground text-sm leading-snug">
            {lesson.grade && (
              <span className="block font-semibold text-foreground">
                {catalogCopy.grade(lesson.grade)}
              </span>
            )}
            {lesson.chapter}
          </p>
        </div>
        <h1 className="heading-page break-words sm:text-[2.5rem]">
          {lesson.title}
        </h1>
        {lesson.description && (
          <MathText
            text={lesson.description}
            className="max-w-prose text-muted-foreground sm:text-lg"
          />
        )}
        {lesson.tags.length > 0 && (
          <ul aria-label={catalogCopy.tag} className="flex flex-wrap gap-2">
            {lesson.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground text-sm"
              >
                #{tag}
              </li>
            ))}
          </ul>
        )}
      </header>

      <ul className="grid grid-cols-3 gap-3 lg:col-start-1">
        <Fact
          icon={ListChecks}
          label={t.questionsLabel}
          value={catalogCopy.questions(total)}
        />
        <Fact
          icon={Clock}
          label={t.duration}
          value={
            lesson.timeLimitSec
              ? formatDuration(lesson.timeLimitSec)
              : t.noLimitShort
          }
        />
        <Fact
          icon={lesson.countsForRating ? Trophy : Dumbbell}
          label={t.mode}
          value={lesson.countsForRating ? t.modeRated : t.modePractice}
        />
      </ul>

      {/* Phones: start right after the facts; desktop: a sticky right column. */}
      <div className="lg:sticky lg:top-8 lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:self-start">
        <StartCard lesson={lesson}>{attempts}</StartCard>
      </div>

      <section
        aria-labelledby="structure-heading"
        className={cn(cardClass, "min-w-0 space-y-5 p-5 sm:p-6 lg:col-start-1")}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="structure-heading" className="heading-section">
            {t.structure}
          </h2>
          <p className="num text-muted-foreground text-sm">
            {catalogCopy.questions(total)}
          </p>
        </div>
        {total > 0 && (
          <div
            aria-hidden
            className="flex h-3 gap-1 overflow-hidden rounded-full"
          >
            {TYPES.map((type) => {
              const n = lesson.typeCounts[type] ?? 0;
              return n ? (
                <span
                  key={type}
                  className={cn("h-full rounded-full", TYPE_FILL[type])}
                  style={{ flexGrow: n }}
                />
              ) : null;
            })}
          </div>
        )}
        <ul className="grid gap-3 sm:grid-cols-3">
          {TYPES.map((type) => (
            <li
              key={type}
              className="flex items-center gap-3 rounded-md bg-muted/70 p-3"
            >
              <span
                aria-hidden
                className={cn("size-3 shrink-0 rounded-full", TYPE_FILL[type])}
              />
              <span className="flex-1 text-sm">{questionTypeLabels[type]}</span>
              <span className="num font-display font-semibold text-lg">
                {lesson.typeCounts[type] ?? 0}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

/** "Làm bài": the rules to know first, then the per-user start panel. */
function StartCard({
  lesson,
  children,
}: {
  lesson: LessonOverview;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={t.rules}
      className={cn(cardClass, "space-y-4 p-5 shadow-raised sm:p-6")}
    >
      <ul className="space-y-2.5 text-sm">
        <li className="flex items-start gap-3">
          <Repeat
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
          <span>
            {t.attempts}:{" "}
            <strong className="font-semibold">
              {lesson.maxAttempts ?? t.unlimited}
            </strong>
          </span>
        </li>
        {lesson.examGuard && (
          <li className="flex items-start gap-3">
            <ShieldCheck
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            {t.guard}
          </li>
        )}
      </ul>
      {children}
    </section>
  );
}
