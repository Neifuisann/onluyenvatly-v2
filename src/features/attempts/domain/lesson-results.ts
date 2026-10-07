/**
 * `/admin/lessons/[id]/results` (lesson → students → tries). Pure: the rows
 * come grouped from the database, these filter, sort and summarize them.
 */
import { foldVietnamese } from "../../lessons/domain/topic.ts";

/** One student who submitted the lesson at least once. */
export type LessonStudent = {
  userId: string;
  fullName: string;
  className: string | null;
  grade: number | null;
  /** Submitted tries. */
  attempts: number;
  latestScore10: number | null;
  bestScore10: number | null;
  latestTimeTakenSec: number | null;
  latestSubmittedAt: Date | null;
};

export const STUDENT_SORTS = ["recent", "name", "score"] as const;
export type StudentSort = (typeof STUDENT_SORTS)[number];

/** Vietnamese names sort by given name, the last word, then the rest. */
function nameKey(fullName: string): string {
  const folded = foldVietnamese(fullName);
  const words = folded.split(" ");
  const given = words.pop() ?? "";
  return `${given} ${words.join(" ")}`;
}

const time = (d: Date | null) => d?.getTime() ?? 0;

/**
 * Every word of `q` must appear in the name (no accents needed), then the
 * order: newest submission, name, or latest score (highest first).
 */
export function filterStudents<T extends LessonStudent>(
  rows: readonly T[],
  q: string,
  sort: StudentSort,
): T[] {
  const words = foldVietnamese(q).split(" ").filter(Boolean);
  const kept = words.length
    ? rows.filter((r) => {
        const name = foldVietnamese(r.fullName);
        return words.every((w) => name.includes(w));
      })
    : [...rows];
  const byName = (a: T, b: T) =>
    nameKey(a.fullName).localeCompare(nameKey(b.fullName), "vi");
  switch (sort) {
    case "name":
      return kept.sort(byName);
    case "score":
      return kept.sort(
        (a, b) =>
          (b.latestScore10 ?? -1) - (a.latestScore10 ?? -1) || byName(a, b),
      );
    case "recent":
      return kept.sort(
        (a, b) =>
          time(b.latestSubmittedAt) - time(a.latestSubmittedAt) || byName(a, b),
      );
  }
}

export type LessonResultsSummary = {
  students: number;
  attempts: number;
  /** Mean of each student's latest score, 2 decimals; null without scores. */
  average: number | null;
  /** Students whose latest score is ≥ 5. */
  passed: number;
  /** Students whose latest score is < 1. */
  low: number;
};

export function summarizeStudents(
  rows: readonly LessonStudent[],
): LessonResultsSummary {
  const scores = rows.flatMap((r) =>
    r.latestScore10 === null ? [] : [r.latestScore10],
  );
  const total = scores.reduce((s, x) => s + x, 0);
  return {
    students: rows.length,
    attempts: rows.reduce((s, r) => s + r.attempts, 0),
    average: scores.length
      ? Math.round((total / scores.length) * 100) / 100
      : null,
    passed: scores.filter((s) => s >= 5).length,
    low: scores.filter((s) => s < 1).length,
  };
}
