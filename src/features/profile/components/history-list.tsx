import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatDuration } from "@/features/lessons/messages";
import { RatingDelta } from "@/features/rating/components/rating-delta";
import { formatDateTime, formatScore } from "@/lib/dates";
import { profileCopy as t } from "../messages";
import type { HistoryItem } from "../queries";

/** My submitted tests, newest first, each linking to its result page. */
export function HistoryList({ items }: { items: readonly HistoryItem[] }) {
  return (
    <ol className="divide-y rounded-lg border bg-surface">
      {items.map((a) => (
        <li key={a.id}>
          <Link
            href={`/attempts/${a.id}/result`}
            // Long list: no prefetch storm (14 §9).
            prefetch={false}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{a.lessonTitle}</p>
              <p className="text-muted-foreground text-xs">
                {a.submittedAt && formatDateTime(a.submittedAt)}
                {a.timeTakenSec !== null &&
                  ` · ${formatDuration(a.timeTakenSec)}`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="num font-semibold tabular-nums">
                <span className="sr-only">{t.score} </span>
                {formatScore(a.score10 ?? 0)}
              </span>
              {a.delta !== null && (
                <RatingDelta value={a.delta} label={t.ratingChange} />
              )}
            </div>
            <ChevronRight
              aria-hidden
              className="size-5 shrink-0 text-muted-foreground"
            />
          </Link>
        </li>
      ))}
    </ol>
  );
}
