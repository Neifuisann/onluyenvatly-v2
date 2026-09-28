import { Skeleton } from "@/components/ui/skeleton";
import { profileCopy } from "@/features/profile/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={profileCopy.loading}
      className="mx-auto flex max-w-4xl flex-col gap-6"
    >
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {["a", "b", "c", "d"].map((key) => (
          <Skeleton key={key} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </section>
  );
}
