"use client";

import { useActionState, useRef } from "react";
import { FormField, fieldA11y } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authCopy } from "@/lib/messages";
import { changePassword, logout } from "../actions";
import { PasswordInput } from "./password-input";
import { useFocusError } from "./use-focus-error";

/**
 * Forced password change after an admin reset (06 §1). Password fields are
 * never refilled after an error.
 */
export function ChangePasswordForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(changePassword, null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusError(formRef, state);
  const failed = state && !state.ok ? state : null;
  const fe = failed?.fieldErrors ?? {};

  return (
    <div className="grid gap-4">
      <form ref={formRef} action={action} noValidate className="grid gap-4">
        {failed && !failed.fieldErrors && (
          <Alert variant="danger" tabIndex={-1} data-form-error>
            {failed.message}
          </Alert>
        )}
        <input type="hidden" name="next" value={next} />
        <FormField
          id="current"
          label={authCopy.currentPassword}
          hint={authCopy.currentPasswordHint}
          error={fe.current}
        >
          <PasswordInput
            {...fieldA11y("current", fe.current, authCopy.currentPasswordHint)}
            name="current"
            autoComplete="current-password"
            required
          />
        </FormField>
        <FormField
          id="password"
          label={authCopy.newPassword}
          hint={authCopy.newPasswordHint}
          error={fe.password}
        >
          <PasswordInput
            {...fieldA11y("password", fe.password, authCopy.newPasswordHint)}
            name="password"
            autoComplete="new-password"
            required
          />
        </FormField>
        <FormField
          id="confirm"
          label={authCopy.confirmPassword}
          error={fe.confirm}
        >
          <PasswordInput
            {...fieldA11y("confirm", fe.confirm)}
            name="confirm"
            autoComplete="new-password"
            required
          />
        </FormField>
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          aria-disabled={pending}
        >
          {pending
            ? authCopy.changePasswordPending
            : authCopy.changePasswordSubmit}
        </Button>
      </form>
      <form action={logout} className="text-center">
        <Button type="submit" variant="link" className="min-h-11">
          {authCopy.logout}
        </Button>
      </form>
    </div>
  );
}
