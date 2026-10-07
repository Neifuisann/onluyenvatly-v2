import { cn } from "@/lib/utils";
import { adminLessonsCopy as t } from "../../messages";

const tone = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-success-soft text-success-text",
  archived: "bg-accent-soft text-accent-text",
} as const;

const dot = {
  draft: "bg-muted-foreground/60",
  published: "bg-success",
  archived: "bg-accent",
} as const;

/** "Nháp" / "Đã xuất bản" / "Lưu trữ": a dot plus text, never color alone. */
export function LessonStatusBadge({
  status,
  className,
}: {
  status: keyof typeof tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 font-semibold text-xs",
        tone[status],
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", dot[status])} />
      {t.statuses[status]}
    </span>
  );
}
