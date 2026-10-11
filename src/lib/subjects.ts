import { z } from "zod";

/**
 * School subjects a class or lesson belongs to (B-03). Codes are stored in
 * `classes.subject` and `lessons.subject`; the labels are the Vietnamese UI
 * names. Add a subject here (no migration needed: the column is plain text,
 * validated at every boundary with `SubjectSchema`).
 */
export const SUBJECTS = {
  physics: "Vật lý",
  math: "Toán",
  chemistry: "Hóa học",
  biology: "Sinh học",
  literature: "Ngữ văn",
  english: "Tiếng Anh",
  history: "Lịch sử",
  geography: "Địa lý",
  informatics: "Tin học",
  civics: "Giáo dục công dân",
  technology: "Công nghệ",
  other: "Môn khác",
} as const;

export type Subject = keyof typeof SUBJECTS;

export const SUBJECT_CODES = Object.keys(SUBJECTS) as [Subject, ...Subject[]];

export const DEFAULT_SUBJECT: Subject = "physics";

export const SubjectSchema = z.enum(SUBJECT_CODES);

/** Label for a stored code; an unknown code (removed subject) reads as "other". */
export function subjectLabel(code: string): string {
  return code in SUBJECTS ? SUBJECTS[code as Subject] : SUBJECTS.other;
}
