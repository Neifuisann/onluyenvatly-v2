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
        "m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-lg border bg-surface p-0 text-foreground shadow-popover backdrop:bg-black/50",
        variant === "sheet" &&
          "mb-0 w-full max-w-none rounded-b-none sm:mb-auto sm:w-[calc(100%-2rem)] sm:max-w-md sm:rounded-b-lg",
      )}
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <h2 id={titleId} className="flex-1 font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex size-11 items-center justify-center rounded-md hover:bg-muted"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
}
