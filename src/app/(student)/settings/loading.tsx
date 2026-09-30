import { Skeleton } from "@/components/ui/skeleton";
import { accountCopy } from "@/features/account/messages";

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label={accountCopy.loading}
      className="mx-auto flex max-w-3xl flex-col gap-6"
    >
      <Skeleton className="h-9 w-64" />
      {["avatar", "profile", "password", "sessions"].map((key) => (
        <Skeleton key={key} className="h-40 w-full rounded-lg" />
      ))}
    </section>
  );
}
