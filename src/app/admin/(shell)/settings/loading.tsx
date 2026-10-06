import { Skeleton } from "@/components/ui/skeleton";
import { settingsCopy as t } from "@/features/settings/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={t.loading}
      className="mx-auto flex max-w-3xl flex-col gap-6"
    >
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-96 w-full" />
      <div className="flex flex-col gap-2">
        {["a", "b", "c"].map((key) => (
          <Skeleton key={key} className="h-16 w-full" />
        ))}
      </div>
    </section>
  );
}
