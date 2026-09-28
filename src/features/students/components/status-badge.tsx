import { cn } from "@/lib/utils";
import type { StudentStatus } from "../domain/list";
import { studentsCopy as t } from "../messages";

const statusClass = {
  pending: "bg-warning/25 text-foreground",
  active: "bg-success/15 text-success-text",
  rejected: "bg-danger/10 text-danger-text",
  disabled: "bg-muted text-muted-foreground",
} as const satisfies Record<StudentStatus, string>;

/** Status chip; the word carries the meaning, the color only reinforces it. */
export function StatusBadge({
  status,
  className,
}: {
  status: StudentStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 font-medium text-xs",
        statusClass[status],
        className,
      )}
    >
      {t.statuses[status]}
    </span>
  );
}
