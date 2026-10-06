"use client";

import { ChevronDown, type LucideIcon } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const toolClass =
  "inline-flex h-9 shrink-0 select-none items-center gap-1.5 rounded-md px-2.5 font-medium text-foreground text-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-45 aria-expanded:bg-muted aria-pressed:bg-primary-soft aria-pressed:text-foreground [&_svg]:size-4 [&_svg]:shrink-0";

/**
 * A compact toolbar button (07 §5.6). With `compact`, the label is only the
 * accessible name and the tooltip, so dense rows fit.
 */
export function ToolButton({
  icon: Icon,
  label,
  compact,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  icon: LucideIcon;
  label: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={compact ? label : undefined}
      className={cn(toolClass, compact && "w-9 justify-center px-0", className)}
      {...props}
    >
      <Icon aria-hidden />
      {!compact && <span>{label}</span>}
    </button>
  );
}

export function ToolDivider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-border" />;
}

/**
 * A disclosure menu: the button toggles a panel of buttons below it. Esc or
 * a click outside closes it; choosing an item closes it too.
 */
export function ToolMenu({
  icon: Icon,
  label,
  compact,
  align = "start",
  children,
}: {
  icon: LucideIcon;
  label: string;
  compact?: boolean;
  align?: "start" | "end";
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    // A click or focus (Tab) anywhere else closes the menu.
    const outside = (e: Event) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        title={label}
        aria-label={compact ? label : undefined}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(toolClass, compact && "w-9 justify-center px-0")}
      >
        <Icon aria-hidden />
        {!compact && (
          <>
            <span>{label}</span>
            <ChevronDown aria-hidden className="text-muted-foreground" />
          </>
        )}
      </button>
      <div
        id={id}
        hidden={!open}
        className={cn(
          "absolute top-full z-40 mt-1 max-h-[min(28rem,70dvh)] w-max min-w-52 max-w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-border/70 bg-surface p-1 shadow-popover dark:border-border",
          align === "end" ? "right-0" : "left-0",
        )}
      >
        {open && children(() => setOpen(false))}
      </div>
    </div>
  );
}

export function ToolMenuItem({
  icon: Icon,
  children,
  hint,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  icon?: LucideIcon;
  hint?: string | undefined;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-foreground text-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        className,
      )}
      {...props}
    >
      {Icon && <Icon aria-hidden />}
      <span className="min-w-0 flex-1">
        {children}
        {hint && (
          <span className="block text-muted-foreground text-xs">{hint}</span>
        )}
      </span>
    </button>
  );
}

export function ToolMenuLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2.5 pt-2 pb-1 font-semibold text-muted-foreground text-xs">
      {children}
    </p>
  );
}
