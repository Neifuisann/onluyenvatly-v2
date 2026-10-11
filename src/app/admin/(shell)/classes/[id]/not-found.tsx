import { SearchX } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { classesCopy as t } from "@/features/classes/messages";

export default function AdminClassNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title={t.notFoundTitle}
      description={t.notFoundBody}
      action={
        <Link
          href="/admin/classes"
          prefetch={false}
          className={buttonVariants({ variant: "secondary" })}
        >
          {t.back}
        </Link>
      }
    />
  );
}
