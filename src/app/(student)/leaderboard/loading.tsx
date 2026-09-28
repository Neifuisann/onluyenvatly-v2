import { Skeleton } from "@/components/ui/skeleton";
import { LeaderboardSkeleton } from "@/features/rating/components/leaderboard-list";
import { leaderboardCopy } from "@/features/rating/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={leaderboardCopy.loading}
      className="mx-auto flex max-w-3xl flex-col gap-5"
    >
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-5 w-72 max-w-full" />
      <Skeleton className="h-12 w-full sm:w-64" />
      <LeaderboardSkeleton />
    </section>
  );
}
