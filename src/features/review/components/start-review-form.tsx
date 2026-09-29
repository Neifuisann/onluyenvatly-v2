"use client";

import { Play } from "lucide-react";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { startReviewPractice } from "@/features/attempts/actions";
import { REVIEW_SIZES } from "../domain/practice";
import { reviewCopy as t } from "../messages";

/**
 * "Tạo bài ôn tập" (S7-06): size 10/20/30 under the page's filters. A plain
 * form posting `startReviewPractice`, which opens the runner.
 */
export function StartReviewForm({
  chapter,
  type,
  available,
}: {
  chapter: string | null;
  type: string | null;
  available: number;
}) {
  const [state, action, pending] = useActionState(startReviewPractice, null);
  const failed = state && !state.ok ? state : null;
  return (
    <form action={action} className="grid gap-4">
      {failed && <Alert variant="danger">{failed.message}</Alert>}
      <input type="hidden" name="chapter" value={chapter ?? ""} />
      <input type="hidden" name="type" value={type ?? ""} />
      <fieldset className="grid gap-2">
        <legend className="mb-1 font-medium text-sm">{t.size}</legend>
        <div className="flex flex-wrap gap-2">
          {REVIEW_SIZES.map((n, i) => (
            <label
              key={n}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border bg-surface px-3 text-sm has-checked:border-primary has-checked:bg-primary-soft"
            >
              <input
                type="radio"
                name="count"
                value={n}
                defaultChecked={i === 0}
                className="size-4 accent-primary"
              />
              {t.sizeOption(n)}
            </label>
          ))}
        </div>
      </fieldset>
      <Button
        type="submit"
        size="lg"
        disabled={pending || available === 0}
        aria-disabled={pending || available === 0}
        className="w-full sm:w-fit"
      >
        <Play aria-hidden />
        {pending ? t.starting : t.start}
      </Button>
    </form>
  );
}
