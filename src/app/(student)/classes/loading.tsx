import { Skeleton } from "@/components/ui/skeleton";
import { classesCopy } from "@/features/classes/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={classesCopy.loading}
      className="mx-auto flex max-w-6xl flex-col gap-6"
    >
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-5 w-full max-w-md" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {["a", "b", "c"].map((key) => (
          <Skeleton key={key} className="h-36 w-full" />
        ))}
      </div>
    </section>
  );
}
