import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { overviewCopy as t } from "@/features/lessons/messages";

export default function NotFound() {
  return (
    <EmptyState
      mascot="space"
      title={t.notFoundTitle}
      description={t.notFoundBody}
      action={
        <Link
          href="/classes"
          className={buttonVariants({ variant: "secondary" })}
          prefetch={false}
        >
          {t.back}
        </Link>
      }
    />
  );
}
