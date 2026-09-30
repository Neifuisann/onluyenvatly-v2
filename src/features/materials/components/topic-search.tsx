"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Input } from "@/components/ui/input";
import { searchTopics } from "../domain/materials";
import type { MaterialCatalog } from "../domain/types";
import { materialsCopy as t } from "../messages";

/**
 * Accent-insensitive search over the theory catalog (S8-02). The catalog is
 * small (56 topics), so it runs in the browser and the index stays static.
 * Nothing shows until something is typed; the full list is below it.
 */
export function TopicSearch({ catalog }: { catalog: MaterialCatalog }) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim());
  const hits = deferred ? searchTopics(catalog, deferred) : [];
  return (
    <search className="space-y-3">
      <label htmlFor="topic-search" className="sr-only">
        {t.searchLabel}
      </label>
      <div className="relative">
        <Search
          aria-hidden
          className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-4 size-5 text-muted-foreground"
        />
        <Input
          id="topic-search"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="h-12 rounded-full pl-12"
        />
      </div>
      <div aria-live="polite">
        {deferred && (
          <div className="space-y-2">
            <p className="font-medium text-sm">
              {t.searchResults(hits.length, deferred)}
            </p>
            {hits.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t.searchEmptyHint}
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {hits.slice(0, 12).map((hit) => (
                  <li key={hit.href}>
                    <Link
                      href={hit.href}
                      prefetch={false}
                      className="flex min-h-11 flex-col rounded-md border border-border/70 bg-surface px-4 py-2.5 hover:border-primary"
                    >
                      <span className="font-semibold">{hit.topic.title}</span>
                      <span className="text-muted-foreground text-xs">
                        {t.grade(hit.grade)} · {hit.chapter.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </search>
  );
}
