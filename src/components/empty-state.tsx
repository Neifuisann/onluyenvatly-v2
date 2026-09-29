import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { Mascot, type MascotPose } from "@/components/mascot";
import { cn } from "@/lib/utils";

/**
 * Every list has an empty state (14 §5). Page-level empty states show the
 * bunny; small in-card ones use an icon.
 */
export function EmptyState({
  icon: Icon,
  mascot,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  mascot?: MascotPose;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex animate-rise flex-col items-center gap-3 rounded-lg px-6 py-10 text-center",
        mascot ? "py-8" : "border border-dashed",
        className,
      )}
    >
      {mascot ? (
        <Mascot pose={mascot} size={148} className="mb-1" />
      ) : (
        Icon && (
          <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Icon aria-hidden className="size-6" strokeWidth={1.75} />
          </span>
        )
      )}
      <h2 className="heading-section">{title}</h2>
      {description && (
        <p className="max-w-sm text-balance text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
