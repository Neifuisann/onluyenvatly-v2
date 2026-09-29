"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { FormField, fieldA11y } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { grantExtraAttempts } from "../admin-actions";
import type { GrantableLesson, StudentOverrideRow } from "../admin-queries";
import { studentsCopy as t } from "../messages";
import { useRun } from "./use-run";

/**
 * Extra tries for one student on one lesson (S6-02, `attempt_overrides`):
 * the lessons they took come first in the picker; the grants they have are
 * listed with a remove button.
 */
export function GrantAttempts({
  userId,
  lessons,
  overrides,
}: {
  userId: string;
  lessons: readonly GrantableLesson[];
  overrides: readonly StudentOverrideRow[];
}) {
  const { pending, message, run } = useRun();
  const [lessonId, setLessonId] = useState("");
  const [extra, setExtra] = useState("1");
  const [errors, setErrors] = useState<{ lesson?: string; extra?: string }>({});

  const attempted = lessons.filter((l) => l.attempted);
  const others = lessons.filter((l) => !l.attempted);

  const submit = () => {
    const n = Number(extra);
    const next = {
      ...(lessonId === "" && { lesson: t.grantNeedLesson }),
      ...(!Number.isInteger(n) || n < 1 || n > 100
        ? { extra: t.grantNeedExtra }
        : {}),
    };
    setErrors(next);
    if (next.lesson || next.extra) return;
    run(
      () =>
        grantExtraAttempts({ userId, lessonId: Number(lessonId), extra: n }),
      (d) => t.granted(d.extra),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{t.grantLead}</p>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-start"
      >
        <FormField
          id="grant-lesson"
          label={t.grantLesson}
          error={errors.lesson}
        >
          <Select
            {...fieldA11y("grant-lesson", errors.lesson)}
            value={lessonId}
            onChange={(e) => setLessonId(e.target.value)}
          >
            <option value="">{t.grantLessonPlaceholder}</option>
            {attempted.length > 0 && (
              <optgroup label={t.grantAttempted}>
                {attempted.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={t.grantOthers}>
              {others.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </optgroup>
          </Select>
        </FormField>
        <FormField
          id="grant-extra"
          label={t.grantExtra}
          hint={t.grantExtraHint}
          error={errors.extra}
        >
          <Input
            {...fieldA11y("grant-extra", errors.extra, t.grantExtraHint)}
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          />
        </FormField>
        <Button type="submit" disabled={pending} className="sm:mt-[1.625rem]">
          {t.grantSubmit}
        </Button>
      </form>

      <output
        aria-live="polite"
        className={cn(
          "min-h-5 text-sm",
          message?.error ? "text-danger-text" : "text-muted-foreground",
        )}
      >
        {message?.text}
      </output>

      <div>
        <h3 className="mb-2 font-medium text-sm">{t.grantsCurrent}</h3>
        {overrides.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.grantsNone}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {overrides.map((o) => (
              <li key={o.lessonId} className="flex items-center gap-2 pl-4">
                <span className="min-w-0 flex-1 py-2 text-sm">
                  <span className="break-words">{o.lessonTitle}</span>{" "}
                  <span className="font-medium">
                    {t.grantExtraCount(o.extraAttempts)}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={t.grantRemove(o.lessonTitle)}
                  title={t.grantRemove(o.lessonTitle)}
                  disabled={pending}
                  onClick={() =>
                    run(
                      () =>
                        grantExtraAttempts({
                          userId,
                          lessonId: o.lessonId,
                          extra: 0,
                        }),
                      () => t.grantRemoved,
                    )
                  }
                  className="flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-muted disabled:opacity-50 [&_svg]:size-5"
                >
                  <X aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
