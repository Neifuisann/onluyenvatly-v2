import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  AttemptsChart,
  HardestList,
  OverviewHero,
  OverviewTiles,
} from "@/features/admin/components/overview";
import { overviewCopy as t } from "@/features/admin/messages";
import { getAdminOverview } from "@/features/admin/queries";
import { getAiUsageToday } from "@/features/ai/budget";
import { requireTeacher } from "@/features/auth/guards";
import {
  countTeacherStudents,
  getTeacherClasses,
} from "@/features/classes/queries";
import { createLesson } from "@/features/lessons/admin-actions";
import { adminLessonsCopy } from "@/features/lessons/messages";

export const metadata: Metadata = { title: t.title };

/**
 * `/admin` (S6-06, B-03): the teacher's own dashboard. The overview is a
 * shared cache per teacher (tag `adminOverview`, 5 minutes, one SQL
 * statement); the class and student counts are two small per-request reads
 * on the teacher's classes. The AI tile (S7-01) reads today's budget
 * counter on each view: one primary-key lookup.
 */
export default async function AdminHomePage() {
  const user = await requireTeacher();
  const [overview, classes, students, ai] = await Promise.all([
    getAdminOverview(user.role === "admin" ? null : user.id),
    getTeacherClasses(user),
    countTeacherStudents(user),
    getAiUsageToday(),
  ]);
  const activeClasses = classes.filter((c) => !c.archivedAt).length;
  const firstName = user.fullName.trim().split(/\s+/).at(-1) ?? "";
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:gap-8">
      <PageHeader
        title={t.title}
        lead={firstName ? t.greetingLead(firstName) : t.lead}
        actions={
          <form action={createLesson}>
            <Button type="submit">
              <Plus aria-hidden />
              {adminLessonsCopy.create}
            </Button>
          </form>
        }
      />
      <OverviewHero
        classes={activeClasses}
        attemptsToday={overview.attemptsToday}
      />
      <OverviewTiles
        classes={activeClasses}
        students={students}
        activeStudents={overview.activeStudents}
        attemptsToday={overview.attemptsToday}
        attemptsWeek={overview.attemptsWeek}
        ai={ai}
      />
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <AttemptsChart days={overview.perDay} />
        <HardestList items={overview.hardest} />
      </div>
    </div>
  );
}
