import { BookOpen, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireStudent } from "@/features/auth/guards";
import { FilterBar } from "@/features/lessons/components/filter-bar";
import {
  cardGridClass,
  LessonCard,
} from "@/features/lessons/components/lesson-card";
import {
  catalogHref,
  hasFilters,
  MAX_PAGE,
} from "@/features/lessons/domain/catalog";
import { parseCatalogParams } from "@/features/lessons/domain/catalog-params";
import { catalogCopy as t } from "@/features/lessons/messages";
import { getCatalog, getCatalogFacets } from "@/features/lessons/queries";

export const metadata: Metadata = { title: t.title };

export default async function LessonsPage({
  searchParams,
}: PageProps<"/lessons">) {
  await requireStudent();
  const filters = parseCatalogParams(await searchParams);
  const [catalog, facets] = await Promise.all([
    getCatalog(filters),
    getCatalogFacets(),
  ]);
  const filtered = hasFilters(filters);
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="space-y-2">
        <h1 className="heading-page">{t.title}</h1>
        <p className="text-muted-foreground">{t.lead}</p>
      </header>
      <FilterBar filters={filters} facets={facets} />
      <output className="text-muted-foreground text-sm">
        {t.showing(catalog.items.length, catalog.total)}
      </output>
      {catalog.items.length ? (
        <div className={cardGridClass}>
          {catalog.items.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={filtered ? SearchX : BookOpen}
          title={filtered ? t.noMatchTitle : t.emptyTitle}
          description={filtered ? t.noMatchBody : t.emptyBody}
          action={
            filtered ? (
              <Link
                href="/lessons"
                prefetch={false}
                className={buttonVariants({ variant: "secondary" })}
              >
                {t.clear}
              </Link>
            ) : undefined
          }
        />
      )}
      {catalog.items.length < catalog.total && filters.page < MAX_PAGE && (
        <Link
          href={catalogHref(filters, { page: filters.page + 1 })}
          prefetch={false}
          scroll={false}
          className={buttonVariants({
            variant: "secondary",
            className: "self-center",
          })}
        >
          {t.loadMore}
        </Link>
      )}
    </div>
  );
}
