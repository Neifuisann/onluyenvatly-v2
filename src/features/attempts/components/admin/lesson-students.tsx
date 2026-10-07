"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Avatar } from "@/components/app-shell/user-menu";
import { cardClass } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatScore } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  filterStudents,
  type LessonStudent,
  STUDENT_SORTS,
  type StudentSort,
} from "../../domain/lesson-results";
import { lessonResultsCopy as t } from "../../messages";

export type LessonStudentCard = LessonStudent & {
  /** Pre-formatted on the server (Vietnam time). */
  time: string | null;
  submitted: string | null;
};

/** The result screen's bands (≥ 8 / ≥ 5 / below), as a tint. */
function scoreTone(score: number | null) {
  if (score === null) return "text-muted-foreground";
  if (score >= 8) return "text-success-text";
  if (score >= 5) return "text-accent-text";
  return "text-danger-text";
}

/**
 * One card per student (Azota's "Danh sách đã thi"): latest score, try
 * count, time taken and submission time. Search and sort happen here,
 * on the list the page already read.
 */
export function LessonStudents({
  lessonId,
  rows,
}: {
  lessonId: number;
  rows: readonly LessonStudentCard[];
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<StudentSort>("recent");
  const query = useDeferredValue(q);
  const shown = useMemo(
    () => filterStudents(rows, query, sort),
    [rows, query, sort],
  );

  return (
    <section aria-label={t.listLabel} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-64">
          <label htmlFor="student-search" className="sr-only">
            {t.searchLabel}
          </label>
          <Search
            aria-hidden
            className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-4 size-4 text-muted-foreground"
          />
          <Input
            id="student-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="h-11 pl-10"
          />
        </div>
        <fieldset className="flex w-fit rounded-full bg-muted p-1">
          <legend className="sr-only">{t.sortLabel}</legend>
          {STUDENT_SORTS.map((key) => (
            <label
              key={key}
              className={cn(
                "inline-flex h-9 cursor-pointer items-center rounded-full px-3.5 font-medium text-sm transition-[background-color,color,box-shadow] has-focus-visible:ring-2 has-focus-visible:ring-primary",
                sort === key
                  ? "bg-surface text-foreground shadow-card"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <input
                type="radio"
                name="student-sort"
                value={key}
                checked={sort === key}
                onChange={() => setSort(key)}
                className="sr-only"
              />
              {t.sorts[key]}
            </label>
          ))}
        </fieldset>
      </div>
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {t.shown(shown.length, rows.length)}
      </p>
      {shown.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((r) => (
            <li key={r.userId}>
              <Link
                href={`/admin/lessons/${lessonId}/results/${r.userId}`}
                prefetch={false}
                aria-label={t.open(r.fullName)}
                className={cn(
                  cardClass,
                  "flex h-full flex-col transition-shadow hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                )}
              >
                <div className="flex items-center gap-3 border-b border-border/70 p-4 dark:border-border">
                  <Avatar
                    name={r.fullName}
                    className="size-11 bg-primary-soft text-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{r.fullName}</p>
                    <p className="text-muted-foreground text-sm">
                      {t.score}:{" "}
                      <span
                        className={cn(
                          "num font-bold",
                          scoreTone(r.latestScore10),
                        )}
                      >
                        {r.latestScore10 === null
                          ? "–"
                          : formatScore(r.latestScore10)}
                      </span>{" "}
                      ({t.tries(r.attempts)})
                    </p>
                  </div>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 p-4 text-sm">
                  <dt className="text-muted-foreground">{t.timeTaken}</dt>
                  <dd className="num text-right">{r.time ?? "–"}</dd>
                  <dt className="text-muted-foreground">{t.submittedAt}</dt>
                  <dd className="num text-right">{r.submitted ?? "–"}</dd>
                </dl>
                {r.attempts > 1 && r.bestScore10 !== null && (
                  <p className="-mt-2 px-4 pb-4 text-right text-muted-foreground text-xs">
                    {t.best(formatScore(r.bestScore10))}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg bg-muted p-5 text-center text-muted-foreground text-sm">
          {t.noMatch}
        </p>
      )}
    </section>
  );
}
