import { Clock, ListChecks } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import { catalogCopy, formatDuration } from "../messages";
import type { CatalogItem } from "../queries";

/** No stock photos (07 §3.4): a tile tinted by chapter, from the design tokens. */
const TILES = [
  "bg-primary-soft text-primary",
  "bg-accent/30 text-accent-foreground",
  "bg-success/20 text-success-text",
  "bg-muted text-muted-foreground",
] as const;

function tileFor(key: string): string {
  let h = 0;
  for (const ch of key) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return TILES[h % TILES.length] ?? TILES[0];
}

function Cover({ lesson }: { lesson: CatalogItem }) {
  const src = lesson.coverPath ? mediaUrl(lesson.coverPath) : null;
  if (src)
    return (
      // Lesson media skip next/image to save the optimization quota (ADR-006).
      // biome-ignore lint/performance/noImgElement: see ADR-006
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-24 w-full object-cover"
      />
    );
  const label = lesson.chapter ?? lesson.title;
  return (
    <div
      aria-hidden
      className={cn(
        "relative flex h-24 items-end overflow-hidden p-3",
        tileFor(label),
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(currentColor_1px,transparent_1.5px)] opacity-20 [background-size:14px_14px]" />
      <span className="relative font-bold text-3xl leading-none opacity-80">
        {lesson.grade ?? label.slice(0, 1).toUpperCase()}
      </span>
    </div>
  );
}

/** 07 §4: title, grade chip, chapter, "28 câu · 50 phút". */
export function LessonCard({ lesson }: { lesson: CatalogItem }) {
  return (
    <Link
      href={`/lessons/${lesson.id}`}
      // Long lists: no prefetch storm while scrolling (08, 14 §9).
      prefetch={false}
      className="group flex flex-col overflow-hidden rounded-lg border bg-surface text-surface-foreground shadow-card transition-colors duration-150 hover:border-primary"
    >
      <Cover lesson={lesson} />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap gap-1.5 text-caption">
          {lesson.grade && (
            <span className="rounded-full bg-primary-soft px-2 py-0.5 font-medium text-primary">
              {catalogCopy.grade(lesson.grade)}
            </span>
          )}
          {lesson.chapter && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
              {lesson.chapter}
            </span>
          )}
        </div>
        <h2 className="line-clamp-2 font-semibold leading-snug group-hover:text-primary">
          {lesson.title}
        </h2>
        <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-muted-foreground text-sm">
          <span className="inline-flex items-center gap-1">
            <ListChecks aria-hidden className="size-4" strokeWidth={1.75} />
            {catalogCopy.questions(lesson.questionCount)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock aria-hidden className="size-4" strokeWidth={1.75} />
            {lesson.timeLimitSec
              ? formatDuration(lesson.timeLimitSec)
              : catalogCopy.noTimeLimit}
          </span>
        </p>
      </div>
    </Link>
  );
}

export function LessonCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-surface shadow-card">
      <Skeleton className="h-24 rounded-none" />
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="mt-2 h-4 w-32" />
      </div>
    </div>
  );
}

/** 1 column on phones, 2 on tablets, 3 on desktop (07 §5.5). */
export const cardGridClass = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";
