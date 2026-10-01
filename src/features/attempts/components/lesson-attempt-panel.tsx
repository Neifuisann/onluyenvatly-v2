import {
  ArrowRight,
  CalendarClock,
  ChevronRight,
  Gift,
  Ticket,
} from "lucide-react";
import Link from "next/link";
import { Mascot } from "@/components/mascot";
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
    <div className="space-y-4">
      {(schedule.startsAt || limit !== null || extra > 0) && (
        <ul className="space-y-2.5 text-sm">
          {schedule.startsAt && (
            <li className="flex items-start gap-3">
              <CalendarClock
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              />
              <span>
                {t.startsAt(formatDateTime(new Date(schedule.startsAt)))}
                {close && (
                  <span className="block text-muted-foreground">
                    {t.answersAt(formatDateTime(close))}
                  </span>
                )}
              </span>
            </li>
          )}
          {limit !== null && (
            <li className="flex items-start gap-3">
              <Ticket
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              />
              {t.used(Math.min(closed.length, limit), limit)}
            </li>
          )}
          {extra > 0 && (
            <li className="flex items-start gap-3 font-medium text-success-text">
              <Gift aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t.extra(extra)}
            </li>
          )}
        </ul>
      )}
      {open ? (
        <div className="grid gap-3 rounded-md bg-accent-soft p-4">
          <p className="font-medium text-sm">{t.inProgress}</p>
          <Link
            href={`/attempts/${open.id}`}
            className={buttonVariants({
              size: "lg",
              className: "h-13 w-full text-base",
            })}
            prefetch={false}
          >
            {t.continue}
            <ArrowRight aria-hidden />
          </Link>
        </div>
      ) : check.ok ? (
        <StartAttemptButton lessonId={lessonId} />
      ) : (
        <div className="flex items-center gap-3 rounded-md bg-muted p-4">
          <Mascot
            pose={check.code === "ATTEMPT_LIMIT" ? "ok" : "sleeping"}
            size={64}
            className="shrink-0"
          />
          <p className="font-medium text-sm">
            {check.code === "NOT_OPEN_YET"
              ? t.notOpen(formatDateTime(check.at))
              : check.code === "LESSON_CLOSED"
                ? t.closed
                : t.noneLeft}
          </p>
        </div>
      )}
      <div className="space-y-1 border-t pt-4">
        <h3 className="font-semibold text-sm">{t.history}</h3>
        {closed.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.historyEmpty}</p>
        ) : (
          <ul className="-mx-2">
            {closed.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/attempts/${a.id}/result`}
                  prefetch={false}
                  className="group flex min-h-11 items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  <span className="text-muted-foreground">
                    {formatDateTime(a.submittedAt ?? a.startedAt)}
                  </span>
                  <span className="num inline-flex items-center gap-1 font-semibold group-hover:text-primary">
                    {a.score10 === null
                      ? t.viewResult
                      : t.score(formatScore(a.score10))}
                    <ChevronRight
                      aria-hidden
                      className="size-4 text-muted-foreground"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function LessonAttemptPanelSkeleton() {
  return (
    <section aria-busy="true" aria-label={t.loading} className="space-y-4">
      <Skeleton className="h-13 w-full rounded-full" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-10 w-full" />
    </section>
  );
}
