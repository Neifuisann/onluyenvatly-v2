import { Skeleton } from "@/components/ui/skeleton";
import {
  cardGridClass,
  LessonCardSkeleton,
} from "@/features/lessons/components/lesson-card";
import { catalogCopy } from "@/features/lessons/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={catalogCopy.loading}
      className="mx-auto flex max-w-7xl flex-col gap-6"
    >
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-28 w-full" />
      <div className={cardGridClass}>
        {["a", "b", "c", "d", "e", "f"].map((key) => (
          <LessonCardSkeleton key={key} />
        ))}
      </div>
    </section>
  );
}
