import { Skeleton } from "@/components/ui/skeleton";
import { overviewCopy as t } from "@/features/admin/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={t.loading}
      className="mx-auto flex max-w-5xl flex-col gap-6"
    >
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {["a", "b", "c", "d", "e"].map((key) => (
          <Skeleton key={key} className="h-24 w-full" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </section>
  );
}
