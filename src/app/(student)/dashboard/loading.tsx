import { Skeleton } from "@/components/ui/skeleton";
import { DashboardCardsSkeleton } from "@/features/dashboard/components/dashboard-cards";
import { dashboardCopy } from "@/features/dashboard/messages";
import {
  cardGridClass,
  LessonCardSkeleton,
} from "@/features/lessons/components/lesson-card";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={dashboardCopy.loading}
      className="mx-auto flex max-w-5xl flex-col gap-6"
    >
      <Skeleton className="h-8 w-40" />
      <DashboardCardsSkeleton />
      <div className={cardGridClass}>
        {["a", "b", "c", "d"].map((key) => (
          <LessonCardSkeleton key={key} />
        ))}
      </div>
    </section>
  );
}
