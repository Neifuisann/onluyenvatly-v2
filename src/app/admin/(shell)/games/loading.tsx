import { Skeleton } from "@/components/ui/skeleton";
import { gameCopy } from "@/features/games/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={gameCopy.admin.loading}
      className="mx-auto flex max-w-4xl flex-col gap-6"
    >
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-5 w-full max-w-lg" />
      <div className="grid gap-2.5">
        {["a", "b", "c", "d"].map((key) => (
          <Skeleton key={key} className="h-20 w-full" />
        ))}
      </div>
    </section>
  );
}
