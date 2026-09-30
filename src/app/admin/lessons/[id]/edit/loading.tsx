import { Skeleton } from "@/components/ui/skeleton";
import { editorCopy as t } from "@/features/lessons/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={t.loading}
      className="mx-auto flex max-w-[90rem] flex-col gap-4"
    >
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-9 w-72" />
      <div className="flex items-center gap-2 py-2.5">
        <Skeleton className="h-11 w-44 rounded-full" />
        <Skeleton className="h-11 w-36 rounded-full" />
        <Skeleton className="ml-auto hidden h-11 w-64 rounded-full lg:block" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-11 w-full rounded-full" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        <Skeleton className="hidden h-[70dvh] w-full rounded-lg lg:block" />
      </div>
    </section>
  );
}
