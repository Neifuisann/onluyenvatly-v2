import { Skeleton } from "@/components/ui/skeleton";
import { questionsCopy as t } from "@/features/lessons/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={t.loading}
      className="mx-auto flex max-w-3xl flex-col gap-6"
    >
      <Skeleton className="h-8 w-72 max-w-full" />
      <Skeleton className="h-14 w-full" />
      {["a", "b", "c"].map((key) => (
        <Skeleton key={key} className="h-64 w-full" />
      ))}
    </section>
  );
}
