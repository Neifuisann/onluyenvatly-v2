import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader, SectionCard } from "@/components/page-header";
import { requireTeacher } from "@/features/auth/guards";
import { ClassForm } from "@/features/classes/components/admin/class-form";
import { ClassList } from "@/features/classes/components/admin/class-list";
import { classesCopy as t } from "@/features/classes/messages";
import { getTeacherClasses } from "@/features/classes/queries";

export const metadata: Metadata = { title: t.title };

/**
 * `/admin/classes` (B-03): the teacher's own classes and "Tạo lớp". Per
 * request, so a new class or member count shows at once.
 */
export default async function AdminClassesPage() {
  const user = await requireTeacher();
  const rows = await getTeacherClasses(user);
  const active = rows.filter((c) => !c.archivedAt);
  const archived = rows.filter((c) => c.archivedAt);
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader title={t.title} lead={t.lead} />
      <SectionCard id="class-new" title={t.newClassTitle}>
        <ClassForm />
      </SectionCard>
      {active.length === 0 ? (
        <EmptyState
          mascot="teacher"
          title={t.emptyTitle}
          description={t.emptyBody}
        />
      ) : (
        <ClassList rows={active} showOwner={user.role === "admin"} />
      )}
      {archived.length > 0 && (
        <details className="group space-y-3">
          <summary className="min-h-11 cursor-pointer py-2 font-medium text-muted-foreground">
            {t.showArchived(archived.length)}
          </summary>
          <ClassList rows={archived} showOwner={user.role === "admin"} />
        </details>
      )}
    </div>
  );
}
