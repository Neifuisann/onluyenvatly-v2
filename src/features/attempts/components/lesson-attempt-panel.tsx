import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatScore } from "@/lib/dates";
import { startCopy as t } from "../messages";
import { getMyLessonAttempts } from "../queries";
import { StartAttemptButton } from "./start-attempt-button";

/**
 * "Bắt đầu" / "Tiếp tục" and my past attempts on a lesson overview. Per-user,
 * so it streams in under the cached lesson metadata (02 §3).
 */
export async function LessonAttemptPanel({
  userId,
  lessonId,
  maxAttempts,
  unlimited,
}: {
  userId: string;
  lessonId: number;
  maxAttempts: number | null;
  /** Admins are not limited (06 §2). */
  unlimited: boolean;
}) {
  const mine = await getMyLessonAttempts(userId, lessonId);
  const open = mine.find((a) => a.status === "in_progress");
  const closed = mine.filter((a) => a.status !== "in_progress");
  const limit = unlimited ? null : maxAttempts;
  const left = limit === null || closed.length < limit;

  return (
    <section className="space-y-4 rounded-lg border bg-surface p-5 shadow-card">
      <h2 className="font-semibold text-lg">{t.heading}</h2>
      {limit !== null && (
        <p className="text-muted-foreground text-sm">
          {t.used(Math.min(closed.length, limit), limit)}
        </p>
      )}
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
      ) : left ? (
        <StartAttemptButton lessonId={lessonId} />
      ) : (
        <p className="font-medium text-sm">{t.noneLeft}</p>
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
