import { Skeleton } from "@/components/ui/skeleton";
import { classesCopy } from "@/features/classes/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={classesCopy.loading}
      className="mx-auto flex max-w-4xl flex-col gap-6"
    >
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-5 w-full max-w-lg" />
      <Skeleton className="h-56 w-full" />
      <div className="grid gap-3 sm:grid-cols-2">
        {["a", "b", "c", "d"].map((key) => (
          <Skeleton key={key} className="h-20 w-full" />
        ))}
      </div>
    </section>
  );
}
