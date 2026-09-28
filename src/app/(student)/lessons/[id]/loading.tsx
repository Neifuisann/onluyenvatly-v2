import { Skeleton } from "@/components/ui/skeleton";
import { catalogCopy } from "@/features/lessons/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={catalogCopy.loading}
      className="mx-auto flex max-w-3xl flex-col gap-6"
    >
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-48 w-full" />
    </section>
  );
}
