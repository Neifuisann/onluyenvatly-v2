import { Skeleton } from "@/components/ui/skeleton";
import { resultsCopy as t } from "@/features/attempts/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={t.loading}
      className="mx-auto flex max-w-4xl flex-col gap-6"
    >
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-40 w-full" />
      <div className="flex flex-col gap-2">
        {["a", "b", "c", "d", "e", "f"].map((key) => (
          <Skeleton key={key} className="h-20 w-full" />
        ))}
      </div>
    </section>
  );
}
