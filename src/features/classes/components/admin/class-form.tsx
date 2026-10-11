"use client";

import { useState, useTransition } from "react";
import { FormField, fieldA11y } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { SUBJECT_CODES, SUBJECTS, type Subject } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { createClass, updateClass } from "../../actions";
import type { ClassFormInput } from "../../domain/classes";
import { classesCopy as t } from "../../messages";

type Message = { text: string; error: boolean };
const FIELDS = ["name", "subject", "grade", "description"] as const;

/**
 * Create or edit a class (B-03). Creating opens the new class's page;
 * editing stays and says "Đã lưu".
 */
export function ClassForm({
  classId,
  initial,
  onDone,
}: {
  /** Set when editing. */
  classId?: number;
  initial?: ClassFormInput;
  onDone?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<Message>();
  const prefix = classId ? `class-${classId}` : "class-new";

  const submit = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const input: ClassFormInput = {
      name: String(data.get("name") ?? ""),
      subject: String(data.get("subject") ?? "physics") as Subject,
      grade: String(data.get("grade") ?? "") as ClassFormInput["grade"],
      description: String(data.get("description") ?? ""),
    };
    setMessage(undefined);
    startTransition(async () => {
      const result = classId
        ? await updateClass({ id: classId, form: input })
        : await createClass(input);
      if (result.ok) {
        setErrors({});
        setMessage({ text: t.saved, error: false });
        onDone?.();
        return;
      }
      const fe = result.fieldErrors ?? {};
      setErrors(fe);
      setMessage({ text: result.message, error: true });
      const first = FIELDS.find((k) => fe[k]);
      if (first)
        form.querySelector<HTMLElement>(`#${prefix}-${first}`)?.focus();
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
      <FormField id={`${prefix}-name`} label={t.name} error={errors.name}>
        <Input
          {...fieldA11y(`${prefix}-name`, errors.name)}
          name="name"
          defaultValue={initial?.name ?? ""}
          placeholder={t.namePlaceholder}
          autoComplete="off"
          maxLength={80}
          required
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`${prefix}-subject`} label={t.subject}>
          <Select
            id={`${prefix}-subject`}
            name="subject"
            defaultValue={initial?.subject ?? "physics"}
          >
            {SUBJECT_CODES.map((code) => (
              <option key={code} value={code}>
                {SUBJECTS[code]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id={`${prefix}-grade`} label={t.grade}>
          <Select
            id={`${prefix}-grade`}
            name="grade"
            defaultValue={initial?.grade ?? ""}
          >
            <option value="">{t.gradeNone}</option>
            {([10, 11, 12] as const).map((g) => (
              <option key={g} value={String(g)}>
                {t.gradeOption(g)}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField
        id={`${prefix}-description`}
        label={t.description}
        hint={t.descriptionHint}
        error={errors.description}
      >
        <Input
          {...fieldA11y(
            `${prefix}-description`,
            errors.description,
            t.descriptionHint,
          )}
          name="description"
          defaultValue={initial?.description ?? ""}
          autoComplete="off"
          maxLength={300}
        />
      </FormField>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {classId
            ? pending
              ? t.saving
              : t.save
            : pending
              ? t.creating
              : t.create}
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
