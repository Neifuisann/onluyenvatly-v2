/**
 * Public share page (S8-03, `/share/lessons/[id]`): a visitor sees the
 * lesson's details and its first questions, answer-free, as a taste.
 */
export const SHARE_PREVIEW_COUNT = 2;

/**
 * Exams stay closed: a scheduled test (`startsAt`) or one in exam mode
 * (`examGuard`) shows no question before a student starts it.
 */
export function sharesQuestions(rules: {
  examGuard: boolean;
  startsAt: string | null;
}): boolean {
  return !rules.examGuard && rules.startsAt === null;
}

/** The first questions in the teacher's order (made answer-free by the caller). */
export function previewQuestions<T>(
  questions: readonly T[],
  count = SHARE_PREVIEW_COUNT,
): T[] {
  return questions.slice(0, Math.max(0, count));
}
