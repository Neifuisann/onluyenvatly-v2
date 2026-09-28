import type * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-input bg-surface px-3 text-base text-foreground transition-colors placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring/40 focus-visible:outline-offset-0",
        "aria-invalid:border-danger-text disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-input bg-surface px-3 text-base text-foreground transition-colors",
        "focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring/40 focus-visible:outline-offset-0",
        "aria-invalid:border-danger-text disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
