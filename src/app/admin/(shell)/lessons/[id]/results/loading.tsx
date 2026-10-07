import { Skeleton } from "@/components/ui/skeleton";
import { lessonResultsCopy as t } from "@/features/attempts/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={t.loading}
      className="mx-auto flex max-w-6xl flex-col gap-6"
    >
      <Skeleton className="h-8 w-72 max-w-full" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {["a", "b", "c", "d", "e"].map((key) => (
          <Skeleton key={key} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-11 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {["f", "g", "h", "i", "j", "k"].map((key) => (
          <Skeleton key={key} className="h-40 w-full" />
        ))}
      </div>
    </section>
  );
}
