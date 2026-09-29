import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/features/auth/guards";
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

export const metadata: Metadata = { title: t.title };

/** `/admin/students/[id]` (S6-01/02): profile, rating, actions, sessions, attempts. */
export default async function AdminStudentPage({
  params,
}: PageProps<"/admin/students/[id]">) {
  await requireAdmin();
  const id = StudentIdSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const [student, attempts, sessions, overrides, lessons] = await Promise.all([
    getStudentDetail(id.data),
    getStudentAttempts(id.data),
    getStudentSessions(id.data),
    getStudentOverrides(id.data),
    getGrantableLessons(id.data),
  ]);
  if (!student) notFound();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/admin/students?view=all"
          prefetch={false}
          className="inline-flex min-h-11 w-fit items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t.back}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="break-words heading-page">{student.fullName}</h1>
          <StatusBadge status={student.status} />
        </div>
      </div>

      <StudentProfile student={student} />

      <section
        aria-labelledby="student-actions"
        className="rounded-lg border border-border/70 bg-surface p-5 shadow-card dark:border-border"
      >
        <h2 id="student-actions" className="mb-3 font-semibold">
          {t.actionsSection}
        </h2>
        <StudentActions
          id={student.id}
          fullName={student.fullName}
          status={student.status}
          attemptTotal={student.attemptTotal}
        />
      </section>

      <section
        aria-labelledby="student-grants"
        className="rounded-lg border border-border/70 bg-surface p-5 shadow-card dark:border-border"
      >
        <h2 id="student-grants" className="mb-3 font-semibold">
          {t.grantSection}
        </h2>
        <GrantAttempts
          userId={student.id}
          lessons={lessons}
          overrides={overrides}
        />
      </section>

      <section aria-labelledby="student-sessions" className="space-y-3">
        <h2 id="student-sessions" className="font-semibold">
          {t.sessionsSection}
        </h2>
        {sessions.length ? (
          <StudentSessions rows={sessions} />
        ) : (
          <p className="text-muted-foreground text-sm">{t.sessionsEmpty}</p>
        )}
      </section>

      <section aria-labelledby="student-attempts" className="space-y-3">
        <h2 id="student-attempts" className="font-semibold">
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
