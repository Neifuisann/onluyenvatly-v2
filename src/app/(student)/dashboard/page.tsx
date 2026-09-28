import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { getCurrentUser } from "@/features/auth/queries";
import { placeholderCopy, shellCopy } from "@/lib/messages";

export const metadata: Metadata = { title: shellCopy.studentNav.dashboard };

// Walking-skeleton dashboard; the real one (continue card, rating, mistakes)
// arrives in S4-06.
export default async function DashboardPage() {
  const user = await getCurrentUser();
  const firstName = user?.fullName.trim().split(/\s+/).at(-1) ?? "";
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="font-semibold text-2xl">
        {shellCopy.greeting(firstName)}
      </h1>
      <EmptyState
        icon={BookOpen}
        title={placeholderCopy.dashboardEmptyTitle}
        description={placeholderCopy.dashboardEmptyBody}
      />
    </div>
  );
}
