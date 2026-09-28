import { Skeleton } from "@/components/ui/skeleton";
import { studentsCopy as t } from "@/features/students/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={t.detailLoading}
      className="mx-auto flex max-w-4xl flex-col gap-6"
    >
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </section>
  );
}
