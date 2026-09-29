import type { Metadata } from "next";
import {
  AttemptsChart,
  HardestList,
  OverviewTiles,
} from "@/features/admin/components/overview";
import { overviewCopy as t } from "@/features/admin/messages";
import { getAdminOverview } from "@/features/admin/queries";
import { getAiUsageToday } from "@/features/ai/budget";
import { requireAdmin } from "@/features/auth/guards";
import { getPendingCount } from "@/features/students/admin-queries";

export const metadata: Metadata = { title: t.title };

/**
 * `/admin` (S6-06). Both reads are shared caches: the overview (tag
 * `adminOverview`, 5 minutes, one SQL statement) and the nav badge's pending
 * count (tag `pendingStudents`). The AI tile (S7-01) reads today's budget
 * counter on each view: one primary-key lookup, admins only.
 */
export default async function AdminHomePage() {
  await requireAdmin();
  const [overview, pending, ai] = await Promise.all([
    getAdminOverview(),
    getPendingCount(),
    getAiUsageToday(),
  ]);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="space-y-2">
        <h1 className="heading-page">{t.title}</h1>
        <p className="text-muted-foreground">{t.lead}</p>
      </header>
      <OverviewTiles
        pending={pending}
        activeStudents={overview.activeStudents}
        attemptsToday={overview.attemptsToday}
        attemptsWeek={overview.attemptsWeek}
        ai={ai}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <AttemptsChart days={overview.perDay} />
        <HardestList items={overview.hardest} />
      </div>
    </div>
  );
}
