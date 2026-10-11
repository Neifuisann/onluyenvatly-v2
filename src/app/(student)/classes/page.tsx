import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { getMyAccount } from "@/features/account/queries";
import { requireStudent } from "@/features/auth/guards";
import { ClassCards } from "@/features/classes/components/class-cards";
import { classesCopy as t } from "@/features/classes/messages";
import { getStudentClasses } from "@/features/classes/queries";

export const metadata: Metadata = { title: t.studentTitle };

/**
 * `/classes` (B-03): the classes the student was added to. A new student
 * has none yet and is told to give their phone number to the teacher.
 * Per-user, one indexed read (two when empty, for the phone).
 */
export default async function ClassesPage() {
  const user = await requireStudent();
  const classes = await getStudentClasses(user.id);
  const phone =
    classes.length === 0
      ? ((await getMyAccount(user.id))?.phone ?? null)
      : null;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="space-y-2">
        <h1 className="heading-page">{t.studentTitle}</h1>
        <p className="text-muted-foreground">{t.studentLead}</p>
      </header>
      {classes.length ? (
        <ClassCards rows={classes} />
      ) : (
        <EmptyState
          mascot="waiting"
          title={t.studentEmptyTitle}
          description={t.studentEmptyBody(phone)}
        />
      )}
    </div>
  );
}
