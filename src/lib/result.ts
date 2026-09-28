import { type ErrorCode, errorMessages } from "./messages";

/** What every server action returns (05). Actions never throw to the client. */
export type Result<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: ErrorCode;
      message: string;
      /** First message per invalid field, for forms. */
      fieldErrors?: Record<string, string>;
    };

/** `useActionState` state for forms: a result plus the values to refill. */
export type FormState =
  | (Result<unknown> & { values?: Record<string, string> })
  | null;

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err(
  code: ErrorCode,
  extra: { message?: string; fieldErrors?: Record<string, string> } = {},
): Result<never> {
  return {
    ok: false,
    code,
    message: extra.message ?? errorMessages[code],
    ...(extra.fieldErrors && { fieldErrors: extra.fieldErrors }),
  };
}
