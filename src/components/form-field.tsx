import type * as React from "react";
import { Label } from "@/components/ui/label";

/**
 * Label + control + hint/error, wired for screen readers. The control gets
 * its a11y props from `fieldA11y(id, …)` so the ids always match.
 */
export function fieldA11y(id: string, error?: string, hint?: string) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`]
    .filter(Boolean)
    .join(" ");
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
  } as const;
}

export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-danger-text text-sm">
          {error}
        </p>
      )}
      {hint && (
        <p id={`${id}-hint`} className="text-muted-foreground text-sm">
          {hint}
        </p>
      )}
    </div>
  );
}
