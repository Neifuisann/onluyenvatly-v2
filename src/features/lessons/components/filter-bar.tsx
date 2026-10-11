import { Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  CATALOG_SORTS,
  type CatalogFilters,
  catalogHref,
  DEFAULT_FILTERS,
  hasFilters,
} from "../domain/catalog";
import { catalogCopy as t } from "../messages";
import type { CatalogFacets } from "../queries";
import { CatalogForm } from "./catalog-form";

const GRADES = [null, 10, 11, 12] as const;

/**
 * Sticky search + grade chips + "Bộ lọc" panel (07 §5.5). `next/form`
 * navigates to GET URLs: the search submits after a short pause (or on
 * Enter) and each select on change, so there is no separate submit button.
 * The panel floats over the list instead of pushing it down. The app's
 * streamed shell requires JavaScript to reveal its content.
 */
export function FilterBar({
  filters,
  facets,
  basePath = "/lessons",
}: {
  filters: CatalogFilters;
  facets: CatalogFacets;
  /** Where the filters navigate: a class page (B-03). */
  basePath?: string;
}) {
  const extraFilters = [filters.chapter, filters.tag].filter(Boolean).length;
  const clearHref = catalogHref(DEFAULT_FILTERS, {}, basePath);

  return (
    <div className="sticky top-14 z-20 -mx-4 bg-background/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-3 lg:-mx-10 lg:bg-panel/85 lg:px-10">
      <CatalogForm filters={filters} basePath={basePath}>
        {filters.grade && (
          <input type="hidden" name="grade" value={filters.grade} />
        )}
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Label htmlFor="catalog-q" className="sr-only">
              {t.searchLabel}
            </Label>
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
              strokeWidth={2}
            />
            <Input
              id="catalog-q"
              name="q"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              maxLength={80}
              defaultValue={filters.q ?? ""}
              placeholder={t.searchPlaceholder}
              className="peer rounded-full pr-12 pl-11 shadow-card [&::-webkit-search-cancel-button]:hidden"
            />
            <button
              type="button"
              data-catalog="clear-q"
              aria-label={t.searchClear}
              className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground peer-placeholder-shown:hidden"
            >
              <X aria-hidden className="size-4" strokeWidth={2.25} />
            </button>
          </div>

          {/* Not positioned itself: the panel anchors to the sticky bar. */}
          <details className="group/filters shrink-0">
            <summary
              aria-label={t.filters}
              className={cn(
                buttonVariants({ variant: "secondary" }),
                "relative h-12 cursor-pointer list-none rounded-full px-3.5 group-open/filters:border-primary group-open/filters:text-primary sm:px-5 [&::-webkit-details-marker]:hidden",
              )}
            >
              <SlidersHorizontal aria-hidden strokeWidth={2} />
              <span aria-hidden className="hidden sm:inline">
                {t.filters}
              </span>
              {extraFilters > 0 && (
                <span className="num absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs sm:static">
                  <span className="sr-only">(</span>
                  {extraFilters}
                  <span className="sr-only">)</span>
                </span>
              )}
            </summary>
            <div className="absolute inset-x-4 top-full z-30 -mt-1 animate-pop rounded-lg border border-border/70 bg-surface p-4 shadow-popover sm:inset-x-6 lg:inset-x-10 dark:border-border">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="catalog-chapter">{t.chapter}</Label>
                  <Select
                    id="catalog-chapter"
                    name="chapter"
                    defaultValue={filters.chapter ?? ""}
                  >
                    <option value="">{t.chapterAll}</option>
                    {facets.chapters.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="catalog-tag">{t.tag}</Label>
                  <Select
                    id="catalog-tag"
                    name="tag"
                    defaultValue={filters.tag ?? ""}
                  >
                    <option value="">{t.tagAll}</option>
                    {facets.tags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="catalog-sort">{t.sort}</Label>
                  <Select
                    id="catalog-sort"
                    name="sort"
                    defaultValue={filters.sort === "order" ? "" : filters.sort}
                  >
                    {CATALOG_SORTS.map((s) => (
                      <option key={s} value={s === "order" ? "" : s}>
                        {t.sorts[s]}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                {hasFilters(filters) && (
                  <Link
                    href={clearHref}
                    prefetch={false}
                    scroll={false}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "mr-auto",
                    )}
                  >
                    {t.clear}
                  </Link>
                )}
                <Button type="button" size="sm" data-catalog="close">
                  {t.done}
                </Button>
              </div>
            </div>
          </details>
        </div>

        <div className="flex items-center gap-2">
          <ul
            aria-label={t.gradeGroup}
            className="flex max-w-full overflow-x-auto rounded-full bg-muted p-1 [scrollbar-width:none]"
          >
            {GRADES.map((g) => {
              const active = filters.grade === g;
              return (
                <li key={g ?? "all"} className="shrink-0">
                  <Link
                    href={catalogHref(filters, { grade: g, page: 1 }, basePath)}
                    prefetch={false}
                    scroll={false}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-9 items-center whitespace-nowrap rounded-full px-3.5 font-medium text-sm transition-[background-color,color,box-shadow] duration-150",
                      active
                        ? "bg-surface text-foreground shadow-card"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {g ? t.grade(g) : t.gradeAll}
                  </Link>
                </li>
              );
            })}
          </ul>
          {/* Phones keep the grade chips whole; the panel has the same link. */}
          {hasFilters(filters) && (
            <Link
              href={clearHref}
              prefetch={false}
              scroll={false}
              className={cn(
                buttonVariants({ variant: "link", size: "sm" }),
                "ml-auto hidden shrink-0 px-2 sm:inline-flex",
              )}
            >
              {t.clear}
            </Link>
          )}
        </div>
      </CatalogForm>
    </div>
  );
}
