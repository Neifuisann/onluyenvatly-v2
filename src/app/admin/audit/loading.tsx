import { Skeleton } from "@/components/ui/skeleton";
import { auditCopy as t } from "@/features/audit/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={t.loading}
      className="mx-auto flex max-w-5xl flex-col gap-6"
    >
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-11 w-full max-w-xl rounded-full" />
      <Skeleton className="h-4 w-40" />
      <div className="flex flex-col gap-2">
        {["a", "b", "c", "d", "e", "f"].map((key) => (
          <Skeleton key={key} className="h-20 w-full" />
        ))}
      </div>
    </section>
  );
}
