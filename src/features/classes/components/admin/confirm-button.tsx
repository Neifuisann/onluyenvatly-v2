"use client";

import { type ReactNode, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { classesCopy as t } from "../../messages";

/** A button that asks before running a destructive class action. */
export function ConfirmButton({
  label,
  title,
  body,
  confirmLabel = t.confirm,
  onConfirm,
  disabled,
  variant = "secondary",
  size,
  ariaLabel,
}: {
  label: ReactNode;
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title={title}
        closeLabel={t.close}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              {t.cancel}
            </Button>
            <Button
              variant="danger"
              disabled={disabled}
              onClick={() => {
                close();
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        <p>{body}</p>
      </Dialog>
    </>
  );
}
