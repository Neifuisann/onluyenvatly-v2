import { Skeleton } from "@/components/ui/skeleton";
import { editorCopy as t } from "@/features/lessons/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={t.loading}
      className="mx-auto flex max-w-7xl flex-col gap-4"
    >
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[60dvh] w-full" />
        <Skeleton className="h-[60dvh] w-full" />
      </div>
    </section>
  );
}
