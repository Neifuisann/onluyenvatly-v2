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
 * Sticky search + grade chips + "Bộ lọc" panel (07 §5.5). A plain GET form,
 * so it works without JS; with JS, `next/form` navigates client-side and the
 * search submits itself after a short pause.
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

  const submit = (delay = 0) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => formRef.current?.requestSubmit(), delay);
  };
  const extraFilters = [filters.chapter, filters.tag].filter(Boolean).length;

  return (
    <div className="sticky top-14 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur lg:top-0 lg:-mx-8 lg:px-8">
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
        <div className="flex gap-2">
          <Label htmlFor="catalog-q" className="sr-only">
            {t.searchLabel}
          </Label>
          <div className="relative flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.75}
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
              className="pl-10"
            />
          </div>
          <Button type="submit" variant="secondary">
            {t.searchSubmit}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ul aria-label={t.gradeGroup} className="flex gap-1.5">
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
                      "inline-flex h-9 items-center rounded-full border px-3.5 text-sm transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-surface hover:bg-muted",
                    )}
                  >
                    {g ? t.grade(g) : t.gradeAll}
                  </Link>
                </li>
              );
            })}
          </ul>

          <details className="group w-full" open={extraFilters > 0}>
            <summary
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden",
              )}
            >
              <SlidersHorizontal aria-hidden strokeWidth={1.75} />
              {t.filters}
              {extraFilters > 0 && ` (${extraFilters})`}
            </summary>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
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
              <div className="flex items-center gap-3 sm:col-span-3">
                {/* Without JS the selects need a submit button. */}
                <noscript>
                  <Button type="submit" size="sm">
                    {t.apply}
                  </Button>
                </noscript>
                {hasFilters(filters) && (
                  <Link
                    href={catalogHref(DEFAULT_FILTERS)}
                    prefetch={false}
                    className={buttonVariants({ variant: "link", size: "sm" })}
                  >
                    {t.clear}
                  </Link>
                )}
              </div>
            </div>
          </details>
        </div>
      </Form>
    </div>
  );
}
