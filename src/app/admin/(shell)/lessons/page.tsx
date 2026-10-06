import { Plus, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/features/auth/guards";
import { createLesson } from "@/features/lessons/admin-actions";
import { getAdminLessons } from "@/features/lessons/admin-queries";
import { AdminListFilterBar } from "@/features/lessons/components/admin/admin-list-filters";
import { LessonTable } from "@/features/lessons/components/admin/lesson-table";
import {
  ADMIN_PAGE_SIZE,
  adminListHref,
  canReorder,
  parseAdminListParams,
} from "@/features/lessons/domain/admin-list";
import { adminLessonsCopy as t } from "@/features/lessons/messages";
import { formatDateTime } from "@/lib/dates";
import { shellCopy } from "@/lib/messages";
import { paginate } from "@/lib/pagination";

export const metadata: Metadata = { title: t.title };

/**
 * `/admin/lessons?q=&status=&page=` (S5-01): 20 lessons per page. One read
 * of the (small) matching list; the page is sliced here so reordering a page
 * can send the whole order back.
 */
export default async function AdminLessonsPage({
  searchParams,
}: PageProps<"/admin/lessons">) {
  await requireAdmin();
  const filters = parseAdminListParams(await searchParams);
  const all = await getAdminLessons(filters);
  const filtered = !canReorder(filters);
  const slice = paginate(all, filters.page, ADMIN_PAGE_SIZE);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title={t.title}
        lead={t.lead}
        actions={
          <>
            <Link
              href="/admin/import"
              prefetch={false}
              className={buttonVariants({ variant: "secondary" })}
            >
              <Sparkles aria-hidden />
              {shellCopy.adminNavItems.import}
            </Link>
            <form action={createLesson}>
              <Button type="submit">
                <Plus aria-hidden />
                {t.create}
              </Button>
            </form>
          </>
        }
      />
      <AdminListFilterBar filters={filters} />
      {slice.total ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-muted-foreground text-sm">
            <p className="num">
              {slice.pageCount > 1
                ? t.countRange(
                    slice.offset + 1,
                    slice.offset + slice.items.length,
                    slice.total,
                  )
                : t.count(slice.total)}
            </p>
            {filtered && <p>{t.reorderHint}</p>}
          </div>
          <LessonTable
            order={filtered ? null : all.map((r) => r.id)}
            offset={slice.offset}
            rows={slice.items.map(({ updatedAt, ...r }) => ({
              ...r,
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
          mascot={filtered ? "telescope" : "studying"}
          title={filtered ? t.noMatchTitle : t.emptyTitle}
          description={filtered ? t.noMatchBody : t.emptyBody}
          action={
            filtered ? (
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
