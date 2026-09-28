import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The test runner is full-screen: no app shell, so its own sticky header and
 * thumb-zone bottom bar own the screen (07 §5.2). Pages call the guards.
 */
export default function RunnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<RunnerSkeleton />}>{children}</Suspense>;
}

function RunnerSkeleton() {
  return (
    <div aria-busy="true" className="flex min-h-dvh flex-col">
      <div className="h-[4.5rem] border-b" />
      <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
