import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader, SectionCard } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireTeacher } from "@/features/auth/guards";
import {
  getDeletionRequests,
  getStudents,
  type Viewer,
} from "@/features/students/admin-queries";
import { StudentFilterBar } from "@/features/students/components/student-filters";
import { StudentList } from "@/features/students/components/student-list";
import {
  MAX_PAGE,
  parseStudentListParams,
  type StudentListFilters,
  studentsHref,
} from "@/features/students/domain/list";
import { studentsCopy as t } from "@/features/students/messages";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: t.title };

/**
 * `/admin/students` (S6-01, B-03): the students of the teacher's classes (an
 * admin: every student) with search and filters. Registration needs no
 * approval any more, so there is no queue. Per request and uncached.
 */
export default async function AdminStudentsPage({
  searchParams,
}: PageProps<"/admin/students">) {
  const user = await requireTeacher();
  const filters = parseStudentListParams(await searchParams);
  const admin = user.role === "admin";
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader title={t.title} lead={admin ? t.leadAdmin : t.lead} />
      {admin && <DeletionRequests />}
      <AllView viewer={user} f={filters} />
    </div>
  );
}

/**
 * Students who asked to be deleted (S8-04), oldest first; the teacher opens
 * each one and uses "Xóa học sinh" there. Hidden when there are none (one
 * lookup on a partial index).
 */
async function DeletionRequests() {
  const rows = await getDeletionRequests();
  if (rows.length === 0) return null;
  return (
    <SectionCard
      id="deletion-requests"
      title={t.deletionTitle(rows.length)}
      lead={t.deletionLead}
      className="border-danger/40 dark:border-danger/40"
    >
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id} className="py-2 first:pt-0 last:pb-0">
            <Link
              href={`/admin/students/${r.id}`}
              prefetch={false}
              className="flex min-h-11 flex-wrap items-center gap-x-3 rounded-md px-2 hover:bg-muted"
            >
              <span className="font-semibold">{r.fullName}</span>
              {r.className && (
                <span className="text-muted-foreground text-sm">
                  {r.className}
                </span>
              )}
              <span className="ml-auto text-muted-foreground text-sm">
                {t.deletionAt(formatDateTime(r.requestedAt))}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

async function AllView({
  viewer,
  f,
}: {
  viewer: Viewer;
  f: StudentListFilters;
}) {
  const { rows, total } = await getStudents(viewer, f);
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
