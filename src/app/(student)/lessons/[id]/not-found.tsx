import { BookOpen } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { overviewCopy as t } from "@/features/lessons/messages";

export default function NotFound() {
  return (
    <EmptyState
      icon={BookOpen}
      title={t.notFoundTitle}
      description={t.notFoundBody}
      action={
        <Link
          href="/lessons"
          className={buttonVariants({ variant: "secondary" })}
        >
          {t.back}
        </Link>
      }
    />
  );
}
