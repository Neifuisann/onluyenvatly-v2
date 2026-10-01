"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { FormField, fieldA11y } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { authCopy } from "@/lib/messages";
import { register } from "../actions";
import { PasswordInput } from "./password-input";
import { useFocusError } from "./use-focus-error";

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusError(formRef, state);
  const failed = state && !state.ok ? state : null;
  const fe = failed?.fieldErrors ?? {};
  const v = failed?.values ?? {};

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      className="grid grid-cols-2 gap-x-3 gap-y-2.5 [&_[data-slot=input]]:h-11 [&_[data-slot=select]]:h-11"
    >
      {failed && !failed.fieldErrors && (
        <Alert
          variant="danger"
          tabIndex={-1}
          data-form-error
          className="col-span-2"
        >
          {failed.message}
        </Alert>
      )}
      <FormField id="fullName" label={authCopy.fullName} error={fe.fullName}>
        <Input
          {...fieldA11y("fullName", fe.fullName)}
          name="fullName"
          autoComplete="name"
          required
          defaultValue={v.fullName ?? ""}
        />
      </FormField>
      <FormField id="phone" label={authCopy.phone} error={fe.phone}>
        <Input
          {...fieldA11y("phone", fe.phone)}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          defaultValue={v.phone ?? ""}
        />
      </FormField>
      <FormField
        id="dateOfBirth"
        label={authCopy.dateOfBirth}
        error={fe.dateOfBirth}
      >
        <Input
          {...fieldA11y("dateOfBirth", fe.dateOfBirth)}
          name="dateOfBirth"
          type="date"
          autoComplete="bday"
          required
          defaultValue={v.dateOfBirth ?? ""}
        />
      </FormField>
      <FormField id="grade" label={authCopy.grade} error={fe.grade}>
        <Select
          {...fieldA11y("grade", fe.grade)}
          name="grade"
          defaultValue={v.grade ?? ""}
        >
          <option value="">{authCopy.gradeNone}</option>
          <option value="10">10</option>
          <option value="11">11</option>
          <option value="12">12</option>
        </Select>
      </FormField>
      <FormField
        id="className"
        label={authCopy.className}
        hint={authCopy.classNameHint}
        error={fe.className}
      >
        <Input
          {...fieldA11y("className", fe.className, authCopy.classNameHint)}
          name="className"
          autoCapitalize="characters"
          placeholder="12A1"
          maxLength={20}
          defaultValue={v.className ?? ""}
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
          minLength={8}
          required
        />
      </FormField>
      <Button
        type="submit"
        size="lg"
        className="col-span-2"
        disabled={pending}
        aria-disabled={pending}
      >
        {pending ? authCopy.registerPending : authCopy.registerSubmit}
      </Button>
      <p className="col-span-2 text-center text-muted-foreground text-xs">
        {authCopy.agreePrefix}{" "}
        <Link
          href="/terms"
          prefetch={false}
          className="font-medium text-primary underline underline-offset-4"
        >
          {authCopy.agreeTerms}
        </Link>{" "}
        {authCopy.agreeAnd}{" "}
        <Link
          href="/privacy"
          prefetch={false}
          className="font-medium text-primary underline underline-offset-4"
        >
          {authCopy.agreePrivacy}
        </Link>
        .
      </p>
      <p className="col-span-2 text-center text-muted-foreground text-sm">
        {authCopy.haveAccount}{" "}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
          prefetch={false}
        >
          {authCopy.loginLink}
        </Link>
      </p>
    </form>
  );
}
