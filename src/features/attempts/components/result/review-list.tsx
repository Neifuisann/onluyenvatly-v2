"use client";

import { type ReactNode, useState } from "react";
import type { Outcome } from "@/features/grading/domain/grade";
import { cn } from "@/lib/utils";
import {
  countOutcomes,
  matchesFilter,
  type ReviewFilter,
} from "../../domain/review";
import { reviewCopy as t } from "../../messages";

/**
 * Filter chips over server-rendered `ReviewItem`s (07 §5.4). Filtering hides
 * items in place: nothing is fetched and nothing new reaches the browser.
 */
export function ReviewList({
  items,
}: {
  items: { outcome: Outcome; node: ReactNode }[];
}) {
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const counts = countOutcomes(items);
  const chips: { id: ReviewFilter; label: string }[] = [
    { id: "all", label: t.all(counts.all) },
    { id: "wrong", label: t.wrong(counts.wrong) },
    { id: "right", label: t.right(counts.right) },
  ];
  const visible = items.filter((i) => matchesFilter(i.outcome, filter));
  return (
    <section
      id="review"
      aria-labelledby="review-heading"
      className="flex scroll-mt-4 flex-col gap-4"
    >
      <h2 id="review-heading" className="heading-section">
        {t.heading}
      </h2>
      <fieldset className="flex w-fit flex-wrap gap-1 rounded-full bg-muted p-1">
        <legend className="sr-only">{t.filterLabel}</legend>
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={filter === c.id}
            onClick={() => setFilter(c.id)}
            className={cn(
              "num h-10 rounded-full px-4 font-medium text-sm transition-[background-color,color,box-shadow] duration-150",
              filter === c.id
                ? "bg-surface text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </fieldset>
      {visible.length === 0 && (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          {filter === "wrong" ? t.emptyWrong : t.emptyRight}
        </p>
      )}
      {items.map((item, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed test order
          key={i}
          hidden={!matchesFilter(item.outcome, filter)}
        >
          {item.node}
        </div>
      ))}
    </section>
  );
}
