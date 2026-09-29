/**
 * Zod schemas of the student admin actions (S6-01/02), shared by the actions
 * and the forms. Ids are checked here so nothing else reaches SQL.
 */
import { z } from "zod";
import { isValidUsername } from "@/features/auth/core/login-policy";
import { passwordIssue } from "@/features/auth/core/password";
import { fieldMessages, passwordIssueMessages } from "@/lib/messages";
import { BULK_LIMIT } from "./list";

export const StudentIdSchema = z.uuid();

export const BulkIdsSchema = z.strictObject({
  ids: z
    .array(StudentIdSchema)
    .min(1)
    .max(BULK_LIMIT)
    .refine((ids) => new Set(ids).size === ids.length),
});

export const SetStatusSchema = z.strictObject({
  id: StudentIdSchema,
  status: z.enum(["active", "disabled"]),
});

export const DeleteStudentSchema = z.strictObject({
  id: StudentIdSchema,
  /** Typed by the teacher; must match the student's name. */
  confirmName: z.string().max(200),
});

/** `extra` 1–100 sets the grant; 0 removes it. */
export const GrantAttemptsSchema = z.strictObject({
  userId: StudentIdSchema,
  lessonId: z
    .number()
    .int()
    .positive()
    .max(2 ** 53),
  extra: z.number().int().min(0).max(100),
});

export const CreateAdminSchema = z.strictObject({
  fullName: z
    .string()
    .trim()
    .transform((s) => s.replace(/\s+/g, " "))
    .pipe(
      z.string().min(2, fieldMessages.fullName).max(80, fieldMessages.fullName),
    ),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .refine(isValidUsername, fieldMessages.username),
  password: z.string().superRefine((password, ctx) => {
    const issue = passwordIssue(password);
    if (issue)
      ctx.addIssue({ code: "custom", message: passwordIssueMessages[issue] });
  }),
});
export type CreateAdminInput = z.infer<typeof CreateAdminSchema>;

/** Names compare without case, composition of accents or extra spaces. */
export function normalizeName(name: string): string {
  return name.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
}

export function namesMatch(typed: string, actual: string): boolean {
  return normalizeName(typed) === normalizeName(actual);
}
