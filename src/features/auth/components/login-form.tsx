"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useRef } from "react";
import { FormField, fieldA11y } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authCopy } from "@/lib/messages";
import { login } from "../actions";
import { PasswordInput } from "./password-input";
import { useFocusError } from "./use-focus-error";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusError(formRef, state);
  // Validated again on the server (safeNextPath); this only carries it along.
  const next = useSearchParams().get("next") ?? "";
  const failed = state && !state.ok ? state : null;
  const fe = failed?.fieldErrors ?? {};

  return (
    <form ref={formRef} action={action} noValidate className="grid gap-4">
      {failed && failed.code !== "VALIDATION" && (
        <Alert
          variant={failed.code === "ACCOUNT_PENDING" ? "info" : "danger"}
          tabIndex={-1}
          data-form-error
        >
          {failed.message}
        </Alert>
      )}
      <input type="hidden" name="next" value={next} />
      <FormField
        id="identifier"
        label={authCopy.identifier}
        hint={authCopy.identifierHint}
        error={fe.identifier}
      >
        <Input
          {...fieldA11y("identifier", fe.identifier, authCopy.identifierHint)}
          name="identifier"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={failed?.values?.identifier ?? ""}
        />
      </FormField>
      <FormField id="password" label={authCopy.password} error={fe.password}>
        <PasswordInput
          {...fieldA11y("password", fe.password)}
          name="password"
          autoComplete="current-password"
          required
        />
      </FormField>
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        aria-disabled={pending}
      >
        {pending ? authCopy.loginPending : authCopy.loginSubmit}
      </Button>
      <p className="text-center text-muted-foreground text-sm">
        {authCopy.noAccount}{" "}
        <Link
          href="/register"
          prefetch={false}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {authCopy.registerLink}
        </Link>
      </p>
    </form>
  );
}
