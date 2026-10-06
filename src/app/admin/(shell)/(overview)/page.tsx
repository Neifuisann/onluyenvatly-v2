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
import { requireAdmin } from "@/features/auth/guards";
import { createLesson } from "@/features/lessons/admin-actions";
import { adminLessonsCopy } from "@/features/lessons/messages";
import { getPendingCount } from "@/features/students/admin-queries";

export const metadata: Metadata = { title: t.title };

/**
 * `/admin` (S6-06). Both reads are shared caches: the overview (tag
 * `adminOverview`, 5 minutes, one SQL statement) and the nav badge's pending
 * count (tag `pendingStudents`). The AI tile (S7-01) reads today's budget
 * counter on each view: one primary-key lookup, admins only.
 */
export default async function AdminHomePage() {
  const user = await requireAdmin();
  const [overview, pending, ai] = await Promise.all([
    getAdminOverview(),
    getPendingCount(),
    getAiUsageToday(),
  ]);
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
      <OverviewHero pending={pending} attemptsToday={overview.attemptsToday} />
      <OverviewTiles
        pending={pending}
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
