import { ArrowRight, CalendarClock } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatScore } from "@/lib/dates";
import { canStart, revealAt, type Schedule } from "../domain/schedule";
import { startCopy as t } from "../messages";
import { getMyExtraAttempts, getMyLessonAttempts } from "../queries";
import { StartAttemptButton } from "./start-attempt-button";

/**
 * "Bắt đầu" / "Tiếp tục" and my past attempts on a lesson overview. Per-user,
 * so it streams in under the cached lesson metadata (02 §3).
 */
export async function LessonAttemptPanel({
  userId,
  lessonId,
  schedule,
  unlimited,
}: {
  userId: string;
  lessonId: number;
  schedule: Schedule & { maxAttempts: number | null };
  /** Admins are not limited (06 §2). */
  unlimited: boolean;
}) {
  const now = new Date();
  const close = revealAt(schedule);
  // Extra tries only matter with a limit or once the lesson has closed.
  const needsExtra =
    !unlimited &&
    (schedule.maxAttempts !== null || (close !== null && now >= close));
  const [mine, extra] = await Promise.all([
    getMyLessonAttempts(userId, lessonId),
    needsExtra ? getMyExtraAttempts(userId, lessonId) : 0,
  ]);
  const open = mine.find((a) => a.status === "in_progress");
  const closed = mine.filter((a) => a.status !== "in_progress");
  const check = canStart(
    schedule,
    {
      used: closed.length,
      usedSinceClose: close
        ? mine.filter((a) => a.startedAt >= close).length
        : 0,
      extra,
    },
    now,
    unlimited,
  );
  const limit =
    unlimited || schedule.maxAttempts === null
      ? null
      : schedule.maxAttempts + extra;

  return (
    <section className="space-y-4 rounded-lg border bg-surface p-5 shadow-card">
      <h2 className="font-semibold text-lg">{t.heading}</h2>
      {schedule.startsAt && (
        <ul className="space-y-1 text-sm">
          <li className="flex items-center gap-2">
            <CalendarClock aria-hidden className="size-4 shrink-0" />
            {t.startsAt(formatDateTime(new Date(schedule.startsAt)))}
          </li>
          {close && (
            <li className="text-muted-foreground">
              {t.answersAt(formatDateTime(close))}
            </li>
          )}
        </ul>
      )}
      {limit !== null && (
        <p className="text-muted-foreground text-sm">
          {t.used(Math.min(closed.length, limit), limit)}
        </p>
      )}
      {extra > 0 && <p className="text-sm">{t.extra(extra)}</p>}
      {open ? (
        <div className="grid gap-3">
          <p className="text-sm">{t.inProgress}</p>
          <Link
            href={`/attempts/${open.id}`}
            className={buttonVariants({
              size: "lg",
              className: "w-full sm:w-auto sm:self-start",
            })}
          >
            {t.continue}
            <ArrowRight aria-hidden />
          </Link>
        </div>
      ) : check.ok ? (
        <StartAttemptButton lessonId={lessonId} />
      ) : (
        <p className="font-medium text-sm">
          {check.code === "NOT_OPEN_YET"
            ? t.notOpen(formatDateTime(check.at))
            : check.code === "LESSON_CLOSED"
              ? t.closed
              : t.noneLeft}
        </p>
      )}
      <div className="space-y-2 border-t pt-4">
        <h3 className="font-medium text-sm">{t.history}</h3>
        {closed.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.historyEmpty}</p>
        ) : (
          <ul className="divide-y">
            {closed.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/attempts/${a.id}/result`}
                  prefetch={false}
                  className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:text-primary"
                >
                  <span className="text-muted-foreground">
                    {formatDateTime(a.submittedAt ?? a.startedAt)}
                  </span>
                  <span className="font-medium font-mono">
                    {a.score10 === null
                      ? t.viewResult
                      : t.score(formatScore(a.score10))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function LessonAttemptPanelSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label={t.loading}
      className="space-y-4 rounded-lg border bg-surface p-5 shadow-card"
    >
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-12 w-full sm:w-48" />
      <Skeleton className="h-16 w-full" />
    </section>
  );
}
