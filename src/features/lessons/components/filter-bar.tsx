"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { useEffect, useRef } from "react";
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

const GRADES = [null, 10, 11, 12] as const;

/**
 * Sticky search + grade chips + "Bộ lọc" panel (07 §5.5). `next/form`
 * navigates to GET URLs and search submits after a short pause. The app's
 * streamed shell requires JavaScript to reveal its content.
 */
export function FilterBar({
  filters,
  facets,
}: {
  filters: CatalogFilters;
  facets: CatalogFacets;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  // Sync back/forward navigation without remounting the focused search input.
  useEffect(() => {
    clearTimeout(timer.current);
    const values = {
      q: filters.q ?? "",
      chapter: filters.chapter ?? "",
      tag: filters.tag ?? "",
      sort: filters.sort === "order" ? "" : filters.sort,
    };
    for (const [name, value] of Object.entries(values)) {
      const field = formRef.current?.elements.namedItem(name);
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement
      )
        field.value = value;
    }
  }, [filters.q, filters.chapter, filters.tag, filters.sort]);

  const submit = (delay = 0) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => formRef.current?.requestSubmit(), delay);
  };
  const extraFilters = [filters.chapter, filters.tag].filter(Boolean).length;

  return (
    <div className="sticky top-14 z-20 -mx-4 bg-background/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-3 lg:-mx-10 lg:bg-panel/85 lg:px-10">
      <Form
        ref={formRef}
        action="/lessons"
        prefetch={false}
        scroll={false}
        role="search"
        className="flex flex-col gap-3"
      >
        {filters.grade && (
          <input type="hidden" name="grade" value={filters.grade} />
        )}
        <div className="relative">
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
            onChange={() => submit(400)}
            className="rounded-full pr-20 pl-11 shadow-card [&::-webkit-search-cancel-button]:hidden"
          />
          <Button
            type="submit"
            size="sm"
            className="absolute top-1/2 right-1.5 -translate-y-1/2 active:-translate-y-1/2 active:scale-100"
          >
            {t.searchSubmit}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ul
            aria-label={t.gradeGroup}
            className="flex rounded-full bg-muted p-1"
          >
            {GRADES.map((g) => {
              const active = filters.grade === g;
              return (
                <li key={g ?? "all"}>
                  <Link
                    href={catalogHref(filters, { grade: g, page: 1 })}
                    prefetch={false}
                    scroll={false}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-9 items-center rounded-full px-3.5 font-medium text-sm transition-[background-color,color,box-shadow] duration-150",
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

          <details className="group/filters contents">
            <summary
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "ml-auto h-11 cursor-pointer list-none group-open/filters:border-primary group-open/filters:text-primary [&::-webkit-details-marker]:hidden",
              )}
            >
              <SlidersHorizontal aria-hidden strokeWidth={2} />
              {t.filters}
              {extraFilters > 0 && (
                <span className="num flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  <span className="sr-only">(</span>
                  {extraFilters}
                  <span className="sr-only">)</span>
                </span>
              )}
            </summary>
            <div className="grid w-full animate-rise gap-4 rounded-lg border border-border/70 bg-surface p-4 shadow-card sm:grid-cols-3 dark:border-border">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="catalog-chapter">{t.chapter}</Label>
                <Select
                  id="catalog-chapter"
                  name="chapter"
                  defaultValue={filters.chapter ?? ""}
                  onChange={() => submit()}
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
                  onChange={() => submit()}
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
                  onChange={() => submit()}
                >
                  {CATALOG_SORTS.map((s) => (
                    <option key={s} value={s === "order" ? "" : s}>
                      {t.sorts[s]}
                    </option>
                  ))}
                </Select>
              </div>
              {hasFilters(filters) && (
                <div className="sm:col-span-3">
                  <Link
                    href={catalogHref(DEFAULT_FILTERS)}
                    prefetch={false}
                    className={buttonVariants({ variant: "link", size: "sm" })}
                  >
                    {t.clear}
                  </Link>
                </div>
              )}
            </div>
          </details>
        </div>
      </Form>
    </div>
  );
}
