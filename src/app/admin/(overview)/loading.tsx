import { Skeleton } from "@/components/ui/skeleton";
import { overviewCopy as t } from "@/features/admin/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={t.loading}
      className="mx-auto flex max-w-6xl flex-col gap-6 sm:gap-8"
    >
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {["a", "b", "c", "d", "e"].map((key) => (
          <Skeleton
            key={key}
            className="h-36 w-full rounded-lg first:col-span-2 lg:first:col-span-1"
          />
        ))}
      </div>
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    </section>
  );
}
