"use client";

import { useState, useTransition } from "react";
import { FormField, fieldA11y } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/features/auth/components/password-input";
import { createAdmin } from "@/features/students/admin-actions";
import { cn } from "@/lib/utils";
import { settingsCopy as t } from "../messages";

type Message = { text: string; error: boolean };
const FIELDS = ["fullName", "username", "password"] as const;

/**
 * "Thêm quản trị viên" (S6-03) on the S6-02 `createAdmin` action. The new
 * admin logs in with the password set here (no forced change); the fields
 * clear after a success and the password is never kept after an error.
 */
export function CreateAdminForm() {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<Message>();

  const submit = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const input = {
      fullName: String(data.get("fullName") ?? ""),
      username: String(data.get("username") ?? ""),
      password: String(data.get("password") ?? ""),
    };
    setMessage(undefined);
    startTransition(async () => {
      const result = await createAdmin(input);
      const password = form.elements.namedItem("password");
      if (password instanceof HTMLInputElement) password.value = "";
      if (result.ok) {
        form.reset();
        setErrors({});
        setMessage({ text: t.created(input.fullName.trim()), error: false });
        return;
      }
      const fe = result.fieldErrors ?? {};
      setErrors(fe);
      setMessage({ text: result.message, error: true });
      const first = FIELDS.find((k) => fe[k]);
      if (first) form.querySelector<HTMLElement>(`#admin-${first}`)?.focus();
    });
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
      className="grid gap-4"
    >
      <FormField id="admin-fullName" label={t.fullName} error={errors.fullName}>
        <Input
          {...fieldA11y("admin-fullName", errors.fullName)}
          name="fullName"
          autoComplete="off"
          maxLength={80}
          required
        />
      </FormField>
      <FormField
        id="admin-username"
        label={t.newUsername}
        hint={t.usernameHint}
        error={errors.username}
      >
        <Input
          {...fieldA11y("admin-username", errors.username, t.usernameHint)}
          name="username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={32}
          required
        />
      </FormField>
      <FormField
        id="admin-password"
        label={t.password}
        hint={t.passwordHint}
        error={errors.password}
      >
        <PasswordInput
          {...fieldA11y("admin-password", errors.password, t.passwordHint)}
          name="password"
          autoComplete="new-password"
          required
        />
      </FormField>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t.creating : t.create}
        </Button>
        <output
          aria-live="polite"
          className={cn(
            "min-h-5 text-sm",
            message?.error ? "text-danger-text" : "text-muted-foreground",
          )}
        >
          {message?.text}
        </output>
      </div>
    </form>
  );
}
