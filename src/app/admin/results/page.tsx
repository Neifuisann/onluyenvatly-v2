import { ClipboardList, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import {
  getResultLessons,
  getResults,
} from "@/features/attempts/admin-queries";
import { ResultsFilterBar } from "@/features/attempts/components/admin/results-filters";
import { ResultsList } from "@/features/attempts/components/admin/results-list";
import {
  hasFilters,
  parseResultsParams,
  RESULTS_MAX_PAGE,
  resultsHref,
} from "@/features/attempts/domain/results";
import { resultsCopy as t } from "@/features/attempts/messages";
import { requireAdmin } from "@/features/auth/guards";

export const metadata: Metadata = { title: t.title };

/**
 * `/admin/results?lesson=&q=&from=&to=&page=` (S6-04): students' submitted
 * attempts, newest first, 50 more per "Xem thêm". Per request, uncached.
 */
export default async function AdminResultsPage({
  searchParams,
}: PageProps<"/admin/results">) {
  await requireAdmin();
  const filters = parseResultsParams(await searchParams);
  const [{ rows, hasMore }, lessons] = await Promise.all([
    getResults(filters),
    getResultLessons(),
  ]);
  const filtered = hasFilters(filters);
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="space-y-2">
        <h1 className="font-semibold text-2xl">{t.title}</h1>
        <p className="text-muted-foreground">{t.lead}</p>
      </header>
      <ResultsFilterBar filters={filters} lessons={lessons} />
      {rows.length > 0 ? (
        <>
          <p className="text-muted-foreground text-sm">
            {t.shown(rows.length, hasMore)}
          </p>
          <ResultsList rows={rows} />
          {hasMore &&
            (filters.page < RESULTS_MAX_PAGE ? (
              <Link
                href={resultsHref(filters, { page: filters.page + 1 })}
                prefetch={false}
                scroll={false}
                className={buttonVariants({
                  variant: "secondary",
                  className: "self-center",
                })}
              >
                {t.loadMore}
              </Link>
            ) : (
              <p className="text-center text-muted-foreground text-sm">
                {t.limitReached}
              </p>
            ))}
        </>
      ) : (
        <EmptyState
          icon={filtered ? SearchX : ClipboardList}
          title={filtered ? t.noMatchTitle : t.emptyTitle}
          description={filtered ? t.noMatchBody : t.emptyBody}
          action={
            filtered ? (
              <Link
                href="/admin/results"
                prefetch={false}
                className={buttonVariants({ variant: "secondary" })}
              >
                {t.clear}
              </Link>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
