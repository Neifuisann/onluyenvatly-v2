"use client";

import { LogOut } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { FormField, fieldA11y } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PasswordInput } from "@/features/auth/components/password-input";
import type { Result } from "@/lib/result";
import {
  cancelAccountDeletion,
  requestAccountDeletion,
  revokeMySession,
  setMyPrivacy,
} from "../actions";
import { accountCopy as t } from "../messages";

/** "Chỉ hiện tên viết tắt": saved as soon as it is toggled. */
export function PrivacyToggle({ initial }: { initial: boolean }) {
  const [checked, setChecked] = useState(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <label className="flex min-h-11 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          disabled={pending}
          aria-describedby="initials-hint"
          onChange={(e) => {
            const next = e.target.checked;
            setChecked(next);
            start(async () => {
              const r = await setMyPrivacy({ leaderboardInitials: next });
              if (!r.ok) setChecked(!next);
              setMessage(
                r.ok
                  ? { ok: true, text: t.privacySaved }
                  : { ok: false, text: r.message },
              );
            });
          }}
          className="mt-0.5 size-5 shrink-0 accent-primary"
        />
        <span>
          <span className="font-medium">{t.initialsLabel}</span>
          <span
            id="initials-hint"
            className="block text-muted-foreground text-sm"
          >
            {t.initialsHint}
          </span>
        </span>
      </label>
      <p
        aria-live="polite"
        className={
          message?.ok === false
            ? "text-danger-text text-sm"
            : "text-muted-foreground text-sm"
        }
      >
        {message?.text}
      </p>
    </div>
  );
}

/** "Đăng xuất" for one of my other devices. */
export function RevokeSessionButton({
  handle,
  device,
}: {
  handle: string;
  device: string;
}) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        aria-label={t.revokeLabel(device)}
        onClick={() =>
          start(async () => {
            const r = await revokeMySession(handle);
            if (!r.ok) setError(r.message);
          })
        }
      >
        <LogOut aria-hidden />
        {t.revoke}
      </Button>
      {error && (
        <p role="alert" className="text-danger-text text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

/** The deletion request: password + confirm, or the pending request. */
export function DeletionPanel({
  requestedAt,
  isAdmin,
}: {
  /** Already formatted in Vietnam time, or null when none is pending. */
  requestedAt: string | null;
  isAdmin: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState<Result<unknown> | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const failed = state && !state.ok ? state : null;
  const fieldError = failed?.fieldErrors?.password;

  if (isAdmin) return <p className="text-muted-foreground">{t.deleteAdmin}</p>;

  if (requestedAt)
    return (
      <div className="space-y-3">
        <Alert>{t.deleteRequested(requestedAt)}</Alert>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => setState(await cancelAccountDeletion()))
          }
        >
          {t.deleteCancel}
        </Button>
        {failed && (
          <p role="alert" className="text-danger-text text-sm">
            {failed.message}
          </p>
        )}
      </div>
    );

  const submit = () => {
    setConfirming(false);
    const form = formRef.current;
    if (!form) return;
    const password = String(new FormData(form).get("password") ?? "");
    start(async () => {
      const r = await requestAccountDeletion({ password });
      setState(r);
      if (!r.ok)
        form.querySelector<HTMLInputElement>("#deletePassword")?.focus();
    });
  };

  return (
    <form
      ref={formRef}
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setConfirming(true);
      }}
    >
      {state?.ok && <Alert variant="success">{t.deleteCancelled}</Alert>}
      {failed && !fieldError && (
        <Alert variant="danger">{failed.message}</Alert>
      )}
      <FormField
        id="deletePassword"
        label={t.deletePassword}
        error={fieldError}
      >
        <PasswordInput
          {...fieldA11y("deletePassword", fieldError)}
          name="password"
          autoComplete="current-password"
          required
        />
      </FormField>
      <div>
        <Button
          type="submit"
          variant="danger"
          disabled={pending}
          aria-disabled={pending}
        >
          {pending ? t.deleteSubmitting : t.deleteSubmit}
        </Button>
      </div>
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t.deleteTitle}
        closeLabel={t.close}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirming(false)}
            >
              {t.deleteKeep}
            </Button>
            <Button type="button" variant="danger" onClick={submit}>
              {t.deleteSubmit}
            </Button>
          </>
        }
      >
        <p>{t.deleteConfirm}</p>
      </Dialog>
    </form>
  );
}
