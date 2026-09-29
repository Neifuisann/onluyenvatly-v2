import { Skeleton } from "@/components/ui/skeleton";
import { reviewCopy as t } from "@/features/review/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={t.loading}
      className="mx-auto flex max-w-3xl flex-col gap-6"
    >
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-11 w-full sm:max-w-sm" />
      <Skeleton className="h-40 w-full" />
      {["a", "b", "c"].map((key) => (
        <Skeleton key={key} className="h-32 w-full" />
      ))}
    </section>
  );
}
