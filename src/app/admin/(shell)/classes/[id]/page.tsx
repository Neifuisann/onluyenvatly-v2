import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, SectionCard } from "@/components/page-header";
import { requireTeacher } from "@/features/auth/guards";
import { ClassDanger } from "@/features/classes/components/admin/class-danger";
import { ClassForm } from "@/features/classes/components/admin/class-form";
import { LessonPicker } from "@/features/classes/components/admin/lesson-picker";
import { MemberPanel } from "@/features/classes/components/admin/member-panel";
import { ClassIdSchema } from "@/features/classes/domain/classes";
import { classesCopy as t } from "@/features/classes/messages";
import {
  getClassLessonIds,
  getClassMembers,
  getTeacherClass,
} from "@/features/classes/queries";
import { getAssignableLessons } from "@/features/lessons/admin-queries";
import { DEFAULT_SUBJECT, SubjectSchema, subjectLabel } from "@/lib/subjects";

export const metadata: Metadata = { title: t.title };

/**
 * `/admin/classes/[id]` (B-03): one of the teacher's classes: its details,
 * students (add by phone, remove) and lessons ("Giao bài"). Another
 * teacher's class is a 404. Per request.
 */
export default async function AdminClassPage({
  params,
}: PageProps<"/admin/classes/[id]">) {
  const user = await requireTeacher();
  const id = ClassIdSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const cls = await getTeacherClass(user, id.data);
  if (!cls) notFound();
  const [members, assigned, lessons] = await Promise.all([
    getClassMembers(cls.id),
    getClassLessonIds(cls.id),
    getAssignableLessons(user),
  ]);
  const archived = Boolean(cls.archivedAt);
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        back={{ href: "/admin/classes", label: t.back }}
        title={cls.name}
        lead={[
          subjectLabel(cls.subject),
          cls.grade ? t.gradeOption(cls.grade) : null,
          t.members(members.length),
          t.lessons(assigned.length),
        ]
          .filter(Boolean)
          .join(" · ")}
        badges={
          archived && (
            <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground text-xs">
              {t.archivedBadge}
            </span>
          )
        }
      />

      <SectionCard
        id="class-members"
        title={t.membersSection}
        lead={t.membersLead}
      >
        <MemberPanel classId={cls.id} members={members} archived={archived} />
      </SectionCard>

      <SectionCard
        id="class-lessons"
        title={t.lessonsSection}
        lead={t.lessonsLead}
      >
        <LessonPicker
          classId={cls.id}
          lessons={lessons}
          assigned={assigned}
          archived={archived}
        />
      </SectionCard>

      <SectionCard id="class-settings" title={t.settingsSection}>
        <ClassForm
          classId={cls.id}
          initial={{
            name: cls.name,
            subject: SubjectSchema.catch(DEFAULT_SUBJECT).parse(cls.subject),
            grade: cls.grade ? (String(cls.grade) as "10" | "11" | "12") : "",
            description: cls.description ?? "",
          }}
        />
      </SectionCard>

      <SectionCard id="class-danger" title={t.dangerSection}>
        <ClassDanger classId={cls.id} name={cls.name} archived={archived} />
      </SectionCard>
    </div>
  );
}
