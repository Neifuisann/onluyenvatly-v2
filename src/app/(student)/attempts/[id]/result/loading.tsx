import { Skeleton } from "@/components/ui/skeleton";
import { resultCopy } from "@/features/attempts/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={resultCopy.loading}
      className="mx-auto flex max-w-3xl flex-col gap-6"
    >
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-56 w-full rounded-xl" />
      {["a", "b", "c"].map((key) => (
        <Skeleton key={key} className="h-40 w-full rounded-lg" />
      ))}
    </section>
  );
}
