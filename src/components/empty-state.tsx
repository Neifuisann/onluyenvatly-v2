import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

/** Every list has an empty state (14 §5). */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon aria-hidden className="size-6" strokeWidth={1.75} />
      </span>
      <h2 className="font-semibold text-lg">{title}</h2>
      {description && (
        <p className="max-w-sm text-muted-foreground text-sm">{description}</p>
      )}
      {action}
    </div>
  );
}
