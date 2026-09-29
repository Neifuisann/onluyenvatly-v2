import type * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: callers pass htmlFor
    <label
      data-slot="label"
      className={cn("font-semibold text-foreground text-sm", className)}
      {...props}
    />
  );
}
