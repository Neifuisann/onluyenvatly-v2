import { Skeleton } from "@/components/ui/skeleton";
import { statsCopy as t } from "@/features/lessons/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={t.loading}
      className="mx-auto flex max-w-4xl flex-col gap-6"
    >
      <Skeleton className="h-8 w-64 max-w-full" />
      <Skeleton className="h-11 w-72 max-w-full" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {["a", "b", "c", "d"].map((key) => (
          <Skeleton key={key} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-48 w-full" />
      {["e", "f", "g"].map((key) => (
        <Skeleton key={key} className="h-56 w-full" />
      ))}
    </section>
  );
}
