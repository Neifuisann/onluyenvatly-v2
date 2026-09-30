import { Download } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ResultLessonOption } from "../../admin-queries";
import {
  exportHref,
  hasFilters,
  type ResultsFilters,
} from "../../domain/results";
import { resultsCopy as t } from "../../messages";

/**
 * The results filters as a GET form (the URL is the state): lesson, name
 * words, a Vietnam date range. "Xuất CSV" downloads the same filters.
 */
export function ResultsFilterBar({
  filters,
  lessons,
}: {
  filters: ResultsFilters;
  lessons: readonly ResultLessonOption[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <Form
        action="/admin/results"
        prefetch={false}
        scroll={false}
        role="search"
        aria-label={t.filtersLabel}
        // Remount on navigation so the fields show the values in the URL.
        key={JSON.stringify({ ...filters, page: 1 })}
        className="grid gap-3 rounded-lg border border-border/70 bg-surface p-5 shadow-card sm:grid-cols-2 sm:p-6 lg:grid-cols-[2fr_2fr_1fr_1fr] dark:border-border"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="results-lesson">{t.lesson}</Label>
          <Select
            id="results-lesson"
            name="lesson"
            defaultValue={filters.lessonId ?? ""}
          >
            <option value="">{t.allLessons}</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.deleted ? t.deletedLesson(l.title) : l.title}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="results-q">{t.student}</Label>
          <Input
            id="results-q"
            name="q"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            maxLength={80}
            defaultValue={filters.q ?? ""}
            placeholder={t.studentPlaceholder}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="results-from">{t.from}</Label>
          <Input
            id="results-from"
            name="from"
            type="date"
            min="2000-01-01"
            max="2100-12-31"
            defaultValue={filters.from ?? ""}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="results-to">{t.to}</Label>
          <Input
            id="results-to"
            name="to"
            type="date"
            min="2000-01-01"
            max="2100-12-31"
            defaultValue={filters.to ?? ""}
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="submit">{t.apply}</Button>
          {hasFilters(filters) && (
            <Link
              href="/admin/results"
              prefetch={false}
              scroll={false}
              className={buttonVariants({ variant: "secondary" })}
            >
              {t.clear}
            </Link>
          )}
          <a
            href={exportHref(filters)}
            download
            title={t.exportHint}
            className={buttonVariants({
              variant: "secondary",
              className: "sm:ml-auto",
            })}
          >
            <Download aria-hidden />
            {t.export}
          </a>
        </div>
      </Form>
    </div>
  );
}
