import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/app-shell/user-menu";
import { cardClass } from "@/components/ui/card";
import { formatClock, formatDateTime, formatScore } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ResultRow } from "../../admin-queries";
import { resultsCopy as t } from "../../messages";

/** The result screen's bands (≥ 8 / ≥ 5 / below), as a tint; the number carries it. */
function scoreTone(score: number | null) {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score >= 8) return "bg-success-soft text-success-text";
  if (score >= 5) return "bg-accent-soft text-accent-text";
  return "bg-danger-soft text-danger-text";
}

/**
 * One row per submitted attempt: the student (to their detail page), class,
 * lesson, score, time taken, submission time and guard events, plus a link
 * to the attempt. Long list: no prefetch.
 */
export function ResultsList({ rows }: { rows: readonly ResultRow[] }) {
  return (
    <ul
      aria-label={t.listLabel}
      className={cn(
        cardClass,
        "divide-y divide-border/70 overflow-hidden dark:divide-border",
      )}
    >
      {rows.map((r) => {
        const when = r.submittedAt ? formatDateTime(r.submittedAt) : "";
        const klass = t.class(r.className, r.grade);
        return (
          <li key={r.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar
              name={r.fullName}
              className="hidden size-10 bg-primary-soft text-primary sm:flex"
            />
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <Link
                  href={`/admin/students/${r.userId}`}
                  prefetch={false}
                  className="break-words font-semibold underline-offset-4 hover:underline"
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 font-semibold text-accent-text">
                    <ShieldAlert aria-hidden className="size-3.5" />
                    {t.guardBadge(r.guardCount)}
                  </span>
                )}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span
                className={cn(
                  "num min-w-12 rounded-full px-3 py-1 text-center font-bold font-display text-lg leading-tight",
                  scoreTone(r.score10),
                )}
              >
                <span className="sr-only">{t.score} </span>
                {r.score10 === null ? "–" : formatScore(r.score10)}
              </span>
              <Link
                href={`/attempts/${r.id}/result`}
                prefetch={false}
                aria-label={t.viewLabel(r.fullName, when)}
                className="inline-flex min-h-11 items-center rounded-full px-3 font-semibold text-primary text-sm hover:bg-muted"
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
