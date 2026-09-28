import { cva, type VariantProps } from "class-variance-authority";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "flex gap-3 rounded-md border p-3 text-sm [&>svg]:mt-0.5 [&>svg]:size-5 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        info: "border-primary/30 bg-primary-soft text-foreground [&>svg]:text-primary",
        danger: "border-danger/40 bg-surface text-danger-text",
        success: "border-success/40 bg-surface text-success-text",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

const icons = { info: Info, danger: CircleAlert, success: CircleCheck };

/** Never color alone (07 §1): every variant has an icon too. */
export function Alert({
  className,
  variant,
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  const Icon = icons[variant ?? "info"];
  return (
    <div
      data-slot="alert"
      role={variant === "danger" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon aria-hidden strokeWidth={1.75} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
