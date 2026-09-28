import { SearchX } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { studentsCopy as t } from "@/features/students/messages";

export default function StudentNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title={t.notFoundTitle}
      description={t.notFoundBody}
      action={
        <Link
          href="/admin/students?view=all"
          prefetch={false}
          className={buttonVariants({ variant: "secondary" })}
        >
          {t.back}
        </Link>
      }
    />
  );
}
