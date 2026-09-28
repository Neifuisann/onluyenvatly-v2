"use client";

import { type RefObject, useEffect } from "react";

/**
 * After a failed submit, move focus to the first invalid field, or to the
 * form-level alert, so keyboard and screen-reader users hear what went wrong.
 */
export function useFocusError(
  formRef: RefObject<HTMLFormElement | null>,
  state: unknown,
) {
  useEffect(() => {
    if (!state || (state as { ok?: boolean }).ok) return;
    const form = formRef.current;
    const target =
      form?.querySelector<HTMLElement>("[aria-invalid=true]") ??
      form?.querySelector<HTMLElement>("[data-form-error]");
    target?.focus();
  }, [state, formRef]);
}
