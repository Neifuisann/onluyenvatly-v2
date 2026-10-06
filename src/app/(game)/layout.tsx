import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Game rooms (B-05) are full-screen on the ink stage in both themes: phones
 * in a race and the teacher's projector. No app shell; pages call the guards.
 */
export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-ink text-ink-foreground">
      <Suspense fallback={<GameSkeleton />}>{children}</Suspense>
    </div>
  );
}

function GameSkeleton() {
  return (
    <div
      aria-busy="true"
      className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6"
    >
      <Skeleton className="size-28 rounded-full bg-lane dark:bg-lane" />
      <Skeleton className="h-7 w-48 bg-lane dark:bg-lane" />
      <Skeleton className="h-12 w-full bg-lane dark:bg-lane" />
    </div>
  );
}
