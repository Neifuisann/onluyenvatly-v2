import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { QUESTION_TYPES } from "@/features/lessons/schema";
import { cn } from "@/lib/utils";
import {
  type BankSummary,
  type ReviewParams,
  reviewHref,
} from "../domain/practice";
import { reviewCopy as t } from "../messages";

/**
 * Chapter (a GET form, so the URL is shareable and Back works) and type
 * chips (links). Counts come from `summarizeBank`.
 */
export function ReviewFilters({
  params,
  summary,
}: {
  params: ReviewParams;
  summary: BankSummary;
}) {
  const typeCount = QUESTION_TYPES.reduce((s, q) => s + summary.types[q], 0);
  const chip = (active: boolean) =>
    cn(
      "flex min-h-11 items-center rounded-full border px-3 text-sm",
      active
        ? "border-primary bg-primary-soft font-medium text-primary"
        : "bg-surface hover:bg-muted",
    );
  return (
    <section aria-label={t.filtersLabel} className="flex flex-col gap-4">
      {summary.chapters.length > 0 && (
        <form
          method="get"
          action="/review"
          className="flex flex-wrap items-end gap-2"
        >
          {params.type && (
            <input type="hidden" name="type" value={params.type} />
          )}
          <div className="grid min-w-0 flex-1 gap-1.5 sm:max-w-sm">
            <label htmlFor="review-chapter" className="font-medium text-sm">
              {t.chapter}
            </label>
            <Select
              id="review-chapter"
              name="chapter"
              defaultValue={params.chapter ?? ""}
            >
              <option value="">{t.allChapters}</option>
              {summary.chapters.map((c) => (
                <option key={c.name} value={c.name}>
                  {t.withCount(c.name, c.count)}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary">
            {t.apply}
          </Button>
        </form>
      )}
      <nav aria-label={t.type} className="flex flex-wrap gap-2">
        <Link
          href={reviewHref(params, { type: null })}
          prefetch={false}
          aria-current={params.type === null ? "page" : undefined}
          className={chip(params.type === null)}
        >
          {t.withCount(t.allTypes, typeCount)}
        </Link>
        {QUESTION_TYPES.map((q) => (
          <Link
            key={q}
            href={reviewHref(params, { type: q })}
            prefetch={false}
            aria-current={params.type === q ? "page" : undefined}
            className={chip(params.type === q)}
          >
            {t.withCount(t.types[q], summary.types[q])}
          </Link>
        ))}
      </nav>
    </section>
  );
}
