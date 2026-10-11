import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireStudent } from "@/features/auth/guards";
import { ClassIdSchema } from "@/features/classes/domain/classes";
import { classesCopy } from "@/features/classes/messages";
import { getStudentClass } from "@/features/classes/queries";
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
import { subjectLabel } from "@/lib/subjects";

export const metadata: Metadata = { title: classesCopy.title };

/**
 * `/classes/[id]?q=&grade=&chapter=&tag=&sort=&page=` (B-03): the lessons
 * the teacher gave the class. Membership is checked per request (one
 * indexed read); the catalog itself is shared by the class's students.
 * A class the student isn't in, or an archived one, is a 404.
 */
export default async function ClassPage({
  params,
  searchParams,
}: PageProps<"/classes/[id]">) {
  const user = await requireStudent();
  const id = ClassIdSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const cls = await getStudentClass(user.id, id.data);
  if (!cls) notFound();
  const base = `/classes/${cls.id}`;
  const filters = parseCatalogParams(await searchParams);
  const [catalog, facets] = await Promise.all([
    getCatalog(cls.id, filters),
    getCatalogFacets(cls.id),
  ]);
  const filtered = hasFilters(filters);
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        back={{ href: "/classes", label: classesCopy.allClasses }}
        title={cls.name}
        lead={[
          subjectLabel(cls.subject),
          classesCopy.teacher(cls.teacherName),
          cls.description,
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      <FilterBar filters={filters} facets={facets} basePath={base} />
      <output className="text-muted-foreground text-sm">
        {t.showing(catalog.items.length, catalog.total)}
      </output>
      {catalog.items.length ? (
        <div className={cardGridClass}>
          {catalog.items.map((lesson, i) => (
            <LessonCard key={lesson.id} lesson={lesson} priority={i < 2} />
          ))}
        </div>
      ) : (
        <EmptyState
          mascot={filtered ? "telescope" : "studying"}
          title={filtered ? t.noMatchTitle : classesCopy.classEmptyTitle}
          description={filtered ? t.noMatchBody : classesCopy.classEmptyBody}
          action={
            filtered ? (
              <Link
                href={base}
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
          href={catalogHref(filters, { page: filters.page + 1 }, base)}
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
