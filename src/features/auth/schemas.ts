import { z } from "zod";
import { fieldMessages, passwordIssueMessages } from "@/lib/messages";
import { passwordIssue } from "./core/password";
import { normalizePhone } from "./core/phone";

/** Shared by the forms and the server actions (one source of truth). */

export const LoginSchema = z.object({
  identifier: z.string().trim().min(1, fieldMessages.required).max(64),
  password: z.string().min(1, fieldMessages.required).max(200),
  next: z.string().max(512).optional(),
});
export type LoginInput = z.infer<typeof LoginSchema>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isReasonableBirthDate(value: string, today = new Date()): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value)
    return false;
  const year = d.getUTCFullYear();
  return year >= 1940 && d.getTime() <= today.getTime();
}

export const RegisterSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .transform((s) => s.replace(/\s+/g, " "))
      .pipe(
        z
          .string()
          .min(2, fieldMessages.fullName)
          .max(80, fieldMessages.fullName),
      ),
    phone: z
      .string()
      .trim()
      .min(1, fieldMessages.required)
      .transform((raw, ctx) => {
        const phone = normalizePhone(raw);
        if (!phone) {
          ctx.addIssue({ code: "custom", message: fieldMessages.phone });
          return z.NEVER;
        }
        return phone;
      }),
    dateOfBirth: z
      .string()
      .min(1, fieldMessages.required)
      .refine((v) => isReasonableBirthDate(v), fieldMessages.dateOfBirth),
    grade: z
      .enum(["", "10", "11", "12"], { error: fieldMessages.grade })
      .optional()
      .transform((g) => (g ? Number(g) : null)),
    className: z
      .string()
      .trim()
      .max(20, fieldMessages.className)
      .optional()
      .transform((c) => (c ? c.toUpperCase() : null)),
    password: z.string().min(1, fieldMessages.required),
  })
  .superRefine((data, ctx) => {
    const issue = passwordIssue(data.password, data.phone);
    if (issue)
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: passwordIssueMessages[issue],
      });
  });
export type RegisterInput = z.infer<typeof RegisterSchema>;

/** First message per field, for inline form errors. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
