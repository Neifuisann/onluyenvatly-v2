import { SearchX } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { editorCopy as t } from "@/features/lessons/messages";

export default function EditLessonNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title={t.notFoundTitle}
      description={t.notFoundBody}
      action={
        <Link
          href="/admin/lessons"
          prefetch={false}
          className={buttonVariants({ variant: "secondary" })}
        >
          {t.back}
        </Link>
      }
    />
  );
}
