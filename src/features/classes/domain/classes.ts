/**
 * Class rules (B-03): the class form, the teacher's "add students" box and
 * the ids the class actions take. Pure, shared by the forms and the actions.
 */
import { z } from "zod";
import { SubjectSchema } from "../../../lib/subjects.ts";
import { normalizePhone } from "../../auth/core/phone.ts";
import { classesCopy as M } from "../messages.ts";

/** Phones per "Thêm học sinh" submit, and lessons per "Giao bài" submit. */
export const ADD_LIMIT = 200;

export const ClassIdSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(2 ** 53);

const collapse = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim();

export const ClassFormSchema = z.strictObject({
  name: z
    .string()
    .max(500)
    .transform(collapse)
    .pipe(z.string().min(1, M.errors.nameRequired).max(80, M.errors.nameLong)),
  subject: SubjectSchema,
  grade: z
    .enum(["", "10", "11", "12"])
    .transform((g) => (g ? (Number(g) as 10 | 11 | 12) : null)),
  description: z
    .string()
    .max(2000)
    .transform((s) => s.trim())
    .pipe(z.string().max(300, M.errors.descriptionLong))
    .transform((s) => s || null),
});
export type ClassFormInput = z.input<typeof ClassFormSchema>;
export type ClassForm = z.output<typeof ClassFormSchema>;

export const UpdateClassSchema = z.strictObject({
  id: ClassIdSchema,
  form: ClassFormSchema,
});

export const ArchiveClassSchema = z.strictObject({
  id: ClassIdSchema,
  archived: z.boolean(),
});

export const AddMembersSchema = z.strictObject({
  id: ClassIdSchema,
  /** The textarea as typed: one phone per line, or separated by , ; */
  phones: z.string().max(20_000),
});

export const RemoveMemberSchema = z.strictObject({
  id: ClassIdSchema,
  userId: z.uuid(),
});

const LessonIdSchema = z
  .number()
  .int()
  .positive()
  .max(2 ** 53);

/** The class's lessons after "Giao bài": the full set, replacing the old one. */
export const SetLessonsSchema = z.strictObject({
  id: ClassIdSchema,
  lessonIds: z
    .array(LessonIdSchema)
    .max(ADD_LIMIT * 5)
    .refine((ids) => new Set(ids).size === ids.length),
});

export type PhoneList = {
  /** Normalized `0xxxxxxxxx`, deduplicated, in typed order. */
  phones: string[];
  /** What couldn't be read as a phone number, as typed. */
  invalid: string[];
};

/**
 * The "add students" box: phone numbers one per line or separated by
 * commas or semicolons, in any of the ways `normalizePhone` accepts
 * ("0912 345 678", "+84912345678"). Empty entries are skipped.
 */
export function parsePhoneList(text: string): PhoneList {
  const phones: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/[\n,;]+/)) {
    const entry = raw.trim();
    if (!entry) continue;
    const phone = normalizePhone(entry);
    if (!phone) invalid.push(entry);
    else if (!seen.has(phone)) {
      seen.add(phone);
      phones.push(phone);
    }
  }
  return { phones, invalid };
}

export type MemberChange = {
  /** Phones added to the class now. */
  added: number;
  /** Already in the class. */
  already: number;
  /** No student account with that phone (the student must register first). */
  notFound: string[];
  /** Not readable as a phone number. */
  invalid: string[];
};

/** The lessons to give and to take back to go from `current` to `next`. */
export function lessonChanges(
  current: readonly number[],
  next: readonly number[],
): { add: number[]; remove: number[] } {
  const now = new Set(current);
  const wanted = new Set(next);
  return {
    add: next.filter((id) => !now.has(id)),
    remove: current.filter((id) => !wanted.has(id)),
  };
}
