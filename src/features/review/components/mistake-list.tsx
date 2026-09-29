import { EyeOff } from "lucide-react";
import Link from "next/link";
import { MathText } from "@/components/math-text/math-text";
import { QuestionImage } from "@/components/math-text/question-image";
import type { PublicQuestion } from "@/features/lessons/domain/public-question";
import { formatDateTime } from "@/lib/dates";
import { reviewCopy as t } from "../messages";
import type { MistakeRow } from "../queries";

/**
 * The open mistakes, newest first: the stem only (answer-free view, never
 * the key), where it comes from and how often it was missed. The last
 * attempt's result page shows the rest, under its own reveal rules.
 */
export function MistakeList({
  rows,
  questionOf,
}: {
  rows: readonly MistakeRow[];
  questionOf: (row: MistakeRow) => PublicQuestion | undefined;
}) {
  return (
    <ol className="flex flex-col gap-3">
      {rows.map((row) => {
        const q = questionOf(row);
        const type = q?.type ?? row.questionType;
        return (
          <li
            key={`${row.lessonId}:${row.questionId}`}
            className="flex flex-col gap-3 rounded-lg border border-border/70 bg-surface p-5 shadow-card dark:border-border"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {type && (
                <span className="rounded-full bg-muted px-2.5 py-1 font-semibold">
                  {t.types[type]}
                </span>
              )}
              <span className="rounded-full bg-danger-soft px-2.5 py-1 font-semibold text-danger-text">
                {t.wrongCount(row.wrongCount)}
              </span>
              {!row.practicable && (
                <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                  <EyeOff aria-hidden className="size-3" />
                  {t.hidden}
                </span>
              )}
            </div>
            {q ? (
              <div className="line-clamp-4 text-stem">
                <MathText text={q.stem} />
                {q.image && <QuestionImage media={q.image} />}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{t.missing}</p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground text-sm">
              <span className="min-w-0 break-words">
                {t.fromLesson(row.lessonTitle)} ·{" "}
                {t.lastSeen(formatDateTime(row.updatedAt))}
              </span>
              {row.lastAttemptId && (
                <Link
                  href={`/attempts/${row.lastAttemptId}/result`}
                  prefetch={false}
                  className="flex min-h-11 items-center font-medium text-primary hover:underline"
                >
                  {t.openAttempt}
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
