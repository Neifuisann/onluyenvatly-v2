import { Skeleton } from "@/components/ui/skeleton";
import { adminLessonsCopy as t } from "@/features/lessons/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={t.loading}
      className="mx-auto flex max-w-6xl flex-col gap-6"
    >
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-9 w-72" />
      <div className="flex flex-col gap-2">
        {["a", "b", "c", "d", "e", "f"].map((key) => (
          <Skeleton key={key} className="h-14 w-full" />
        ))}
      </div>
    </section>
  );
}
