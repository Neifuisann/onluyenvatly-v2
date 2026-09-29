import { BookOpen, Plus, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/features/auth/guards";
import { createLesson } from "@/features/lessons/admin-actions";
import { getAdminLessons } from "@/features/lessons/admin-queries";
import { AdminListFilterBar } from "@/features/lessons/components/admin/admin-list-filters";
import { LessonTable } from "@/features/lessons/components/admin/lesson-table";
import {
  canReorder,
  parseAdminListParams,
} from "@/features/lessons/domain/admin-list";
import { adminLessonsCopy as t } from "@/features/lessons/messages";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: t.title };

export default async function AdminLessonsPage({
  searchParams,
}: PageProps<"/admin/lessons">) {
  await requireAdmin();
  const filters = parseAdminListParams(await searchParams);
  const rows = await getAdminLessons(filters);
  const filtered = !canReorder(filters);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h1 className="heading-page">{t.title}</h1>
          <p className="text-muted-foreground">{t.lead}</p>
        </div>
        <form action={createLesson}>
          <Button type="submit">
            <Plus aria-hidden />
            {t.create}
          </Button>
        </form>
      </header>
      <AdminListFilterBar filters={filters} />
      {rows.length ? (
        <>
          <p className="text-muted-foreground text-sm">
            {t.count(rows.length)}
          </p>
          <LessonTable
            reorderable={!filtered}
            rows={rows.map(({ updatedAt, ...r }) => ({
              ...r,
              updated: formatDateTime(updatedAt),
            }))}
          />
        </>
      ) : (
        <EmptyState
          icon={filtered ? SearchX : BookOpen}
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
