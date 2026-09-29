import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { formatClock, formatDateTime, formatScore } from "@/lib/dates";
import type { ResultRow } from "../../admin-queries";
import { resultsCopy as t } from "../../messages";

/**
 * One card per submitted attempt: the student (to their detail page), class,
 * lesson, score, time taken, submission time and guard events, plus a link
 * to the attempt. Long list: no prefetch.
 */
export function ResultsList({ rows }: { rows: readonly ResultRow[] }) {
  return (
    <ul
      aria-label={t.listLabel}
      className="divide-y rounded-lg border border-border/70 bg-surface shadow-card dark:border-border"
    >
      {rows.map((r) => {
        const when = r.submittedAt ? formatDateTime(r.submittedAt) : "";
        const klass = t.class(r.className, r.grade);
        return (
          <li key={r.id} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <Link
                  href={`/admin/students/${r.userId}`}
                  prefetch={false}
                  className="break-words font-medium underline-offset-4 hover:underline"
                >
                  {r.fullName}
                </Link>
                {klass && (
                  <span className="text-muted-foreground text-xs">{klass}</span>
                )}
              </div>
              <p className="break-words text-sm">{r.lessonTitle ?? t.review}</p>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
                {r.timeTakenSec !== null && (
                  <span>{t.time(formatClock(r.timeTakenSec))}</span>
                )}
                {when && <span>{t.submitted(when)}</span>}
                {r.guardCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning/25 px-2 py-0.5 font-medium text-foreground">
                    <ShieldAlert aria-hidden className="size-3.5" />
                    {t.guardBadge(r.guardCount)}
                  </span>
                )}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-semibold text-lg tabular-nums">
                <span className="sr-only">{t.score} </span>
                {r.score10 === null ? "–" : formatScore(r.score10)}
              </span>
              <Link
                href={`/attempts/${r.id}/result`}
                prefetch={false}
                aria-label={t.viewLabel(r.fullName, when)}
                className="inline-flex min-h-11 items-center rounded-md px-2 font-medium text-primary text-sm hover:bg-muted"
              >
                {t.view}
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
