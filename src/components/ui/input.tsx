import type * as React from "react";
import { cn } from "@/lib/utils";

/** Borders stay at full `--input` strength: 3:1 against the surface (WCAG 1.4.11). */
const control =
  "h-12 w-full min-w-0 rounded-md border border-input bg-surface px-4 text-base text-foreground transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_var(--primary-soft)] focus-visible:outline-none aria-invalid:border-danger-text aria-invalid:focus-visible:shadow-[0_0_0_4px_var(--danger-soft)] disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input data-slot="input" className={cn(control, className)} {...props} />
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
        control,
        // A chevron drawn from two gradients in the text color (no raw colors, 14 §5).
        "appearance-none bg-no-repeat pr-10 [background-image:linear-gradient(45deg,transparent_50%,currentColor_50%),linear-gradient(135deg,currentColor_50%,transparent_50%)] [background-position:calc(100%-1.25rem)_52%,calc(100%-0.9rem)_52%] [background-size:0.35rem_0.35rem]",
        className,
      )}
      {...props}
    />
  );
}
