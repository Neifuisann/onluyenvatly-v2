import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/features/auth/guards";
import {
  getPendingCount,
  getPendingStudents,
  getStudents,
} from "@/features/students/admin-queries";
import { PendingList } from "@/features/students/components/pending-list";
import { StudentFilterBar } from "@/features/students/components/student-filters";
import { StudentList } from "@/features/students/components/student-list";
import { StudentsTabs } from "@/features/students/components/students-tabs";
import {
  MAX_PAGE,
  parseStudentListParams,
  type StudentListFilters,
  studentsHref,
} from "@/features/students/domain/list";
import { studentsCopy as t } from "@/features/students/messages";
import { formatDateOnly, formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: t.title };

/**
 * `/admin/students` (S6-01): the pending queue with bulk approve/reject, and
 * every student with search and filters. Per request and uncached; only the
 * count on the tab (and the nav badge) comes from the shared cache.
 */
export default async function AdminStudentsPage({
  searchParams,
}: PageProps<"/admin/students">) {
  await requireAdmin();
  const filters = parseStudentListParams(await searchParams);
  const pendingCount = await getPendingCount();
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader title={t.title} lead={t.lead} />
      <StudentsTabs filters={filters} pendingCount={pendingCount} />
      {filters.view === "pending" ? <PendingView /> : <AllView f={filters} />}
    </div>
  );
}

async function PendingView() {
  const { rows, hasMore } = await getPendingStudents();
  if (rows.length === 0)
    return (
      <EmptyState
        mascot="all-clear"
        title={t.pendingEmptyTitle}
        description={t.pendingEmptyBody}
      />
    );
  return (
    <>
      <p className="text-muted-foreground text-sm">
        {hasMore ? t.pendingMore(rows.length) : t.pendingCount(rows.length)}
      </p>
      <PendingList
        rows={rows.map((r) => ({
          id: r.id,
          fullName: r.fullName,
          phone: r.phone,
          details: [
            r.dateOfBirth &&
              `${t.dateOfBirth} ${formatDateOnly(r.dateOfBirth)}`,
            [r.className, r.grade && t.gradeShort(r.grade)]
              .filter(Boolean)
              .join(" · "),
            `${t.registeredAt} ${formatDateTime(r.createdAt)}`,
          ]
            .filter(Boolean)
            .join(" · "),
        }))}
      />
    </>
  );
}

async function AllView({ f }: { f: StudentListFilters }) {
  const { rows, total } = await getStudents(f);
  const filtered = Boolean(f.q || f.status || f.grade);
  return (
    <>
      <StudentFilterBar filters={f} />
      {rows.length ? (
        <>
          <p className="text-muted-foreground text-sm">
            {t.count(rows.length, total)}
          </p>
          <StudentList rows={rows} />
          {rows.length < total && f.page < MAX_PAGE && (
            <Link
              href={studentsHref(f, { page: f.page + 1 })}
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
        </>
      ) : (
        <EmptyState
          mascot={filtered ? "telescope" : "studying"}
          title={filtered ? t.noMatchTitle : t.emptyTitle}
          description={filtered ? t.noMatchBody : t.emptyBody}
          action={
            filtered ? (
              <Link
                href={studentsHref(f, { q: null, status: null, grade: null })}
                prefetch={false}
                className={buttonVariants({ variant: "secondary" })}
              >
                {t.clear}
              </Link>
            ) : undefined
          }
        />
      )}
    </>
  );
}
