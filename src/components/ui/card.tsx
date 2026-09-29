import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 07 §3.3: 18 px radius, one soft shadow. In light mode the shadow does the
 * work (hairline border); in dark mode the border separates surfaces.
 */
export const cardClass =
  "rounded-lg border border-border/70 bg-surface text-surface-foreground shadow-card dark:border-border";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card" className={cn(cardClass, className)} {...props} />
  );
}

export function CardHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 p-5 pb-0 sm:p-6 sm:pb-0", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("heading-section", className)} {...props} />;
}

export function CardDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p className={cn("text-muted-foreground text-sm", className)} {...props} />
  );
}

export function CardContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("p-5 sm:p-6", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-5 pt-0 sm:p-6 sm:pt-0",
        className,
      )}
      {...props}
    />
  );
}
