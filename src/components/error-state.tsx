import { TriangleAlert } from "lucide-react";
import type * as React from "react";
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
        "flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-danger/10 text-danger-text">
        <TriangleAlert aria-hidden className="size-6" strokeWidth={1.75} />
      </span>
      <h2 className="font-semibold text-lg">{title}</h2>
      {description && (
        <p className="max-w-sm text-muted-foreground text-sm">{description}</p>
      )}
      {action}
    </div>
  );
}
