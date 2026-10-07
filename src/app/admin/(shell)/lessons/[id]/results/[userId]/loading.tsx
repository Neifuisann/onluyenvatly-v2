import { Skeleton } from "@/components/ui/skeleton";
import { lessonResultsCopy as t } from "@/features/attempts/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={t.loading}
      className="mx-auto flex max-w-3xl flex-col gap-6"
    >
      <Skeleton className="h-8 w-64 max-w-full" />
      {["a", "b", "c"].map((key) => (
        <Skeleton key={key} className="h-28 w-full" />
      ))}
    </section>
  );
}
