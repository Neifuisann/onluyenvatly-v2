import { Skeleton } from "@/components/ui/skeleton";
import { editorCopy as t } from "@/features/lessons/messages";

/** The workspace's frame: top bar, then the two panes. */
export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={t.loading}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="flex h-14 shrink-0 items-center gap-3 border-border/70 border-b bg-surface px-3 dark:border-border">
        <Skeleton className="size-9 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="mx-auto hidden h-9 w-80 rounded-full lg:block" />
        <Skeleton className="ml-auto h-9 w-24 rounded-full lg:ml-0" />
        <Skeleton className="hidden h-9 w-40 rounded-full lg:block" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex flex-1 flex-col gap-3 bg-panel p-5 max-lg:hidden">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        <div className="flex flex-1 flex-col gap-2 border-border/70 bg-surface p-3 lg:border-l dark:border-border">
          <Skeleton className="h-9 w-full rounded-md" />
          {["a", "b", "c", "d", "e", "f"].map((k) => (
            <Skeleton key={k} className="h-5 w-full" />
          ))}
        </div>
      </div>
    </section>
  );
}
