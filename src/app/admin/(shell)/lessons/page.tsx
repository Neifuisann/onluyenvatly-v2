import { GripVertical, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { buttonVariants } from "@/components/ui/button";
import { requireTeacher } from "@/features/auth/guards";
import { getAdminLessons } from "@/features/lessons/admin-queries";
import { AdminListFilterBar } from "@/features/lessons/components/admin/admin-list-filters";
import { LessonTable } from "@/features/lessons/components/admin/lesson-table";
import {
  ADMIN_PAGE_SIZE,
  adminListHref,
  canReorder,
  isFiltered,
  parseAdminListParams,
  sortAdminRows,
  sortHref,
} from "@/features/lessons/domain/admin-list";
import { adminLessonsCopy as t } from "@/features/lessons/messages";
import { formatDateTime } from "@/lib/dates";
import { paginate } from "@/lib/pagination";

export const metadata: Metadata = { title: t.title };

/**
 * `/admin/lessons?q=&status=&sort=&dir=&page=` (S5-01, S5-07): 20 lessons
 * per page, newest change first unless a column's arrow picks another
 * order. One read of the (small) matching list, sorted and sliced here; in
 * the manual order a reordered page sends the whole order back.
 */
export default async function AdminLessonsPage({
  searchParams,
}: PageProps<"/admin/lessons">) {
  const user = await requireTeacher();
  const filters = parseAdminListParams(await searchParams);
  const all = await getAdminLessons(user, filters);
  const rows = sortAdminRows(all, filters.sort, filters.dir);
  const searching = isFiltered(filters);
  const reorderable = canReorder(filters);
  const slice = paginate(rows, filters.page, ADMIN_PAGE_SIZE);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title={t.title}
        lead={t.lead}
        actions={
          <Link
            href="/admin/lessons/create"
            prefetch={false}
            className={buttonVariants()}
          >
            <Plus aria-hidden />
            {t.create}
          </Link>
        }
      />
      <AdminListFilterBar filters={filters} />
      {slice.total ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-muted-foreground text-sm">
            <p className="num">
              {slice.pageCount > 1
                ? t.countRange(
                    slice.offset + 1,
                    slice.offset + slice.items.length,
                    slice.total,
                  )
                : t.count(slice.total)}
            </p>
            {filters.sort !== "manual" ? (
              <Link
                href={sortHref(filters, "manual")}
                prefetch={false}
                scroll={false}
                className="inline-flex min-h-11 items-center gap-1.5 font-medium hover:text-foreground hover:underline"
              >
                <GripVertical aria-hidden className="size-4" />
                {t.manualLink}
              </Link>
            ) : (
              <p>{searching ? t.reorderHint : t.manualHint}</p>
            )}
          </div>
          <LessonTable
            order={reorderable ? all.map((r) => r.id) : null}
            offset={slice.offset}
            sort={{
              by: filters.sort,
              dir: filters.dir,
              hrefs: {
                title: sortHref(filters, "title"),
                created: sortHref(filters, "created"),
                updated: sortHref(filters, "updated"),
              },
            }}
            rows={slice.items.map(({ createdAt, updatedAt, ...r }) => ({
              ...r,
              created: formatDateTime(createdAt),
              updated: formatDateTime(updatedAt),
            }))}
          />
          <Pagination
            page={slice.page}
            pageCount={slice.pageCount}
            href={(page) => adminListHref(filters, { page })}
          />
        </>
      ) : (
        <EmptyState
          mascot={searching ? "telescope" : "studying"}
          title={searching ? t.noMatchTitle : t.emptyTitle}
          description={searching ? t.noMatchBody : t.emptyBody}
          action={
            searching ? (
              <Link
                href="/admin/lessons"
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
