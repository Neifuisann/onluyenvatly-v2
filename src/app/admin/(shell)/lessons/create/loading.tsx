import { Skeleton } from "@/components/ui/skeleton";
import { createCopy as t } from "@/features/lessons/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={t.title}
      className="mx-auto flex max-w-6xl flex-col gap-6"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-5 w-full max-w-xl" />
      <div className="grid gap-4 md:grid-cols-3">
        {["a", "b", "c"].map((key) => (
          <Skeleton key={key} className="h-56 w-full" />
        ))}
      </div>
    </section>
  );
}
