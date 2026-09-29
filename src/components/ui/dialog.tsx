"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Native `<dialog>` (focus trap, Esc and inert background for free). `sheet`
 * slides up from the bottom on phones (07 §5.2) and is centered from `sm`.
 */
export function Dialog({
  open,
  onClose,
  title,
  closeLabel,
  variant = "center",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  variant?: "center" | "sheet";
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click mirrors Esc, which <dialog> handles natively
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // Click on the backdrop (the dialog box itself, outside the panel) closes.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-xl border border-border/70 bg-surface p-0 text-foreground shadow-popover backdrop:bg-ink/45 backdrop:backdrop-blur-[2px] open:animate-pop dark:border-border",
        variant === "sheet" &&
          "mb-0 w-full max-w-none rounded-b-none open:animate-rise sm:mb-auto sm:w-[calc(100%-2rem)] sm:max-w-md sm:rounded-b-xl sm:open:animate-pop",
      )}
    >
      <div className="flex max-h-[85dvh] flex-col">
        {variant === "sheet" && (
          <span
            aria-hidden
            className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-border sm:hidden"
          />
        )}
        <div className="flex items-center gap-2 py-2 pr-2 pl-5">
          <h2 id={titleId} className="heading-section flex-1 text-lg">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t bg-muted/40 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
}
