import { ArrowUpRight, Clock, ListChecks } from "lucide-react";
import Link from "next/link";
import { preconnect } from "react-dom";
import { cardClass } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import { lessonTopic } from "../domain/topic";
import { catalogCopy, formatDuration } from "../messages";
import type { CatalogItem } from "../queries";
import { TopicGlyph } from "./topic-glyph";

/** 07 §4: topic glyph (or the teacher's cover), title, "28 câu · 50 phút". */
export function LessonCard({
  lesson,
  priority = false,
  className,
}: {
  lesson: CatalogItem;
  /** First cards of a page: above the fold on a phone, often the LCP. */
  priority?: boolean;
  className?: string;
}) {
  const cover = lesson.coverPath ? mediaUrl(lesson.coverPath) : null;
  // Covers live on the Storage origin: open the connection with the HTML.
  if (cover) preconnect(new URL(cover).origin);
  return (
    <Link
      href={`/lessons/${lesson.id}`}
      // Long lists: no prefetch storm while scrolling (08, 14 §9).
      prefetch={false}
      className={cn(
        cardClass,
        "group flex flex-col overflow-hidden transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raised active:translate-y-0",
        className,
      )}
    >
      {cover && (
        // Lesson media skip next/image to save the optimization quota (ADR-006).
        // biome-ignore lint/performance/noImgElement: see ADR-006
        <img
          src={cover}
          alt=""
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          className="h-32 w-full object-cover"
        />
      )}
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          {!cover && (
            <TopicGlyph topic={lessonTopic(lesson.chapter, lesson.title)} />
          )}
          {lesson.grade && (
            <span className="ml-auto rounded-full bg-muted px-2.5 py-1 font-semibold text-muted-foreground text-xs">
              {catalogCopy.grade(lesson.grade)}
            </span>
          )}
        </div>
        <div className="space-y-1">
          <h2 className="line-clamp-2 font-display font-semibold text-[1.0625rem] leading-snug tracking-[-0.01em]">
            {lesson.title}
          </h2>
          {lesson.chapter && (
            <p className="truncate text-muted-foreground text-sm">
              {lesson.chapter}
            </p>
          )}
        </div>
        <div className="mt-auto flex items-start gap-3 border-border/70 border-t pt-3 text-muted-foreground text-sm">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
              <ListChecks
                aria-hidden
                className="size-4 shrink-0"
                strokeWidth={1.75}
              />
              {catalogCopy.questions(lesson.questionCount)}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
              <Clock
                aria-hidden
                className="size-4 shrink-0"
                strokeWidth={1.75}
              />
              <span>
                {lesson.timeLimitSec
                  ? formatDuration(lesson.timeLimitSec)
                  : catalogCopy.noTimeLimit}
              </span>
            </span>
          </div>
          <ArrowUpRight
            aria-hidden
            className="ml-auto size-5 shrink-0 text-muted-foreground/60 transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary"
          />
        </div>
      </div>
    </Link>
  );
}

export function LessonCardSkeleton() {
  return (
    <div className={cn(cardClass, "flex flex-col gap-3 p-5")}>
      <div className="flex justify-between">
        <Skeleton className="size-12 rounded-[0.875rem]" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="mt-2 h-4 w-40" />
    </div>
  );
}

/** 1 column on phones, 2 on tablets, 3 on desktop (07 §5.5). */
export const cardGridClass = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";
