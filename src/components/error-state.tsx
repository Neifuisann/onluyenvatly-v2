import type * as React from "react";
import { Mascot } from "@/components/mascot";
import { cn } from "@/lib/utils";

/** Every data view has an error state (14 §5). Used by `error.tsx` boundaries. */
export function ErrorState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex animate-rise flex-col items-center gap-3 rounded-lg px-6 py-10 text-center",
        className,
      )}
    >
      <Mascot pose="broken" size={148} className="mb-1" />
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
