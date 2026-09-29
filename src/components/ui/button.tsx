import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 07 §3.3: pill buttons, ≥ 44 px touch targets for the default size. A short
 * press-in on `:active` confirms the tap on phones (off with reduced motion).
 */
export const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold text-sm transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-card hover:bg-primary/90",
        secondary:
          "border border-border bg-surface text-foreground shadow-card hover:border-input hover:bg-muted/60",
        soft: "bg-primary-soft text-foreground hover:bg-primary-soft/70",
        ghost: "text-foreground hover:bg-muted",
        ink: "bg-ink-foreground text-ink hover:bg-ink-foreground/90",
        danger:
          "bg-danger text-danger-foreground shadow-card hover:bg-danger/90",
        link: "h-auto rounded-sm px-0 text-primary underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-4",
        lg: "h-12 px-6 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
