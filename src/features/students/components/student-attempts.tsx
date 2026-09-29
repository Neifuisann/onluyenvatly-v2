import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatDateTime, formatScore } from "@/lib/dates";
import type { StudentAttemptRow } from "../admin-queries";
import { studentsCopy as t } from "../messages";

/** Latest submitted attempts, each linking to its result page (admins see it all). */
export function StudentAttempts({
  rows,
}: {
  rows: readonly StudentAttemptRow[];
}) {
  return (
    <ol className="divide-y rounded-lg border bg-surface">
      {rows.map((a) => (
        <li key={a.id}>
          <Link
            href={`/attempts/${a.id}/result`}
            // Long list: no prefetch storm (14 §9).
            prefetch={false}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
          >
            <div className="min-w-0 flex-1">
              <p className="break-words font-medium">
                {a.lessonTitle ??
                  (a.mode === "review" ? t.reviewMode : t.practiceMode)}
              </p>
              <p className="text-muted-foreground text-xs">
                {a.submittedAt && formatDateTime(a.submittedAt)}
              </p>
            </div>
            <span className="font-mono font-semibold tabular-nums">
              <span className="sr-only">{t.score} </span>
              {formatScore(a.score10 ?? 0)}
            </span>
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
