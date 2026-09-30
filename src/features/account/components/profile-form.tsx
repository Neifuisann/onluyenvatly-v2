"use client";

import { useRef, useState, useTransition } from "react";
import { FormField, fieldA11y } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useFocusError } from "@/features/auth/components/use-focus-error";
import { authCopy } from "@/lib/messages";
import type { Result } from "@/lib/result";
import { updateMyProfile } from "../actions";
import { accountCopy as t } from "../messages";

export type ProfileDefaults = {
  fullName: string;
  dateOfBirth: string;
  grade: string;
  className: string;
};

/** Name, birth date, grade and class, with registration's rules (S8-04). */
export function ProfileForm({ defaults }: { defaults: ProfileDefaults }) {
  const [state, setState] = useState<Result<{ changed: string[] }> | null>(
    null,
  );
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  useFocusError(formRef, state);
  const failed = state && !state.ok ? state : null;
  const fe = failed?.fieldErrors ?? {};

  return (
    <form
      ref={formRef}
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const input = Object.fromEntries(new FormData(e.currentTarget));
        start(async () => setState(await updateMyProfile(input)));
      }}
    >
      {failed && !failed.fieldErrors && (
        <Alert variant="danger" tabIndex={-1} data-form-error>
          {failed.message}
        </Alert>
      )}
      <FormField id="fullName" label={authCopy.fullName} error={fe.fullName}>
        <Input
          {...fieldA11y("fullName", fe.fullName)}
          name="fullName"
          autoComplete="name"
          required
          defaultValue={defaults.fullName}
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
          defaultValue={defaults.dateOfBirth}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField id="grade" label={authCopy.grade} error={fe.grade}>
          <Select
            {...fieldA11y("grade", fe.grade)}
            name="grade"
            defaultValue={defaults.grade}
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
            defaultValue={defaults.className}
          />
        </FormField>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} aria-disabled={pending}>
          {pending ? t.profileSaving : t.profileSave}
        </Button>
        <p aria-live="polite" className="text-muted-foreground text-sm">
          {state?.ok &&
            (state.data.changed.length ? t.profileSaved : t.profileUnchanged)}
        </p>
      </div>
    </form>
  );
}
