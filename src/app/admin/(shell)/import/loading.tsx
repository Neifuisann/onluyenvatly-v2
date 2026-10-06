import { Skeleton } from "@/components/ui/skeleton";
import { importCopy as t } from "@/features/ai/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={t.title}
      className="mx-auto flex max-w-3xl flex-col gap-6"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-48 w-full" />
    </section>
  );
}
