import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, SectionCard } from "@/components/page-header";
import { requireTeacher } from "@/features/auth/guards";
import {
  getGrantableLessons,
  getStudentAttempts,
  getStudentDetail,
  getStudentOverrides,
  getStudentSessions,
  STUDENT_ATTEMPTS_LIMIT,
} from "@/features/students/admin-queries";
import { GrantAttempts } from "@/features/students/components/grant-attempts";
import { StatusBadge } from "@/features/students/components/status-badge";
import { StudentActions } from "@/features/students/components/student-actions";
import { StudentAttempts } from "@/features/students/components/student-attempts";
import { StudentProfile } from "@/features/students/components/student-profile";
import { StudentSessions } from "@/features/students/components/student-sessions";
import { StudentIdSchema } from "@/features/students/domain/input";
import { studentsCopy as t } from "@/features/students/messages";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: t.title };

/**
 * `/admin/students/[id]` (S6-01/02, B-03): profile, rating, extra tries and
 * attempts on the viewer's own lessons. A teacher opens only students of
 * their classes; the account tools (password, sessions, status, deletion)
 * are an admin's.
 */
export default async function AdminStudentPage({
  params,
}: PageProps<"/admin/students/[id]">) {
  const user = await requireTeacher();
  const id = StudentIdSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const admin = user.role === "admin";
  // The detail read is the gate: nothing below renders for a student the
  // teacher can't see.
  const student = await getStudentDetail(user, id.data);
  if (!student) notFound();
  const [attempts, sessions, overrides, lessons] = await Promise.all([
    getStudentAttempts(user, id.data),
    admin ? getStudentSessions(id.data) : [],
    getStudentOverrides(user, id.data),
    getGrantableLessons(user, id.data),
  ]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        back={{ href: "/admin/students", label: t.back }}
        title={student.fullName}
        badges={
          <>
            <StatusBadge status={student.status} />
            {student.deletionRequestedAt && (
              <span className="inline-flex rounded-full bg-danger-soft px-3 py-1 font-semibold text-danger-text text-sm">
                {t.deletionBadge}
              </span>
            )}
          </>
        }
        lead={
          student.deletionRequestedAt
            ? t.deletionAt(formatDateTime(student.deletionRequestedAt))
            : undefined
        }
      />

      <StudentProfile student={student} />

      {admin && (
        <SectionCard id="student-actions" title={t.actionsSection}>
          <StudentActions
            id={student.id}
            fullName={student.fullName}
            status={student.status}
            attemptTotal={student.attemptTotal}
          />
        </SectionCard>
      )}

      <SectionCard id="student-grants" title={t.grantSection}>
        <GrantAttempts
          userId={student.id}
          lessons={lessons}
          overrides={overrides}
        />
      </SectionCard>

      {admin && (
        <section aria-labelledby="student-sessions" className="space-y-3">
          <h2 id="student-sessions" className="heading-section">
            {t.sessionsSection}
          </h2>
          {sessions.length ? (
            <StudentSessions rows={sessions} />
          ) : (
            <p className="text-muted-foreground text-sm">{t.sessionsEmpty}</p>
          )}
        </section>
      )}

      <section aria-labelledby="student-attempts" className="space-y-3">
        <h2 id="student-attempts" className="heading-section">
          {t.attemptsSection}
        </h2>
        {attempts.length ? (
          <>
            <StudentAttempts rows={attempts} />
            {student.attemptTotal > STUDENT_ATTEMPTS_LIMIT && (
              <p className="text-muted-foreground text-sm">
                {t.attemptsLimit(attempts.length, student.attemptTotal)}
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">{t.attemptsEmpty}</p>
        )}
      </section>
    </div>
  );
}
