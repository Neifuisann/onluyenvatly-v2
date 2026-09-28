/**
 * Mistakes bank rules (01 R4, 04 mistakes). Pure: graded items in, the
 * question ids to open and to count as correct out.
 */
import type { AttemptItem } from "../../../db/schema.ts";
import type { Outcome } from "../../grading/domain/grade.ts";

/** Correct answers in a row that resolve a mistake. */
export const RESOLVE_STREAK = 2;

export type MistakeStatus = "open" | "resolved";
export type MistakeState = {
  wrongCount: number;
  correctStreak: number;
  status: MistakeStatus;
};

/**
 * Anything short of full marks is a mistake: wrong, partially right (tf) and
 * left blank, since each is a question to review.
 */
export const isMistake = (outcome: Outcome) => outcome !== "correct";

/**
 * Splits a graded attempt into questions that become (or stay) open and
 * questions answered correctly. A question seen twice keeps its worse
 * outcome.
 */
export function mistakeChanges(
  items: readonly Pick<AttemptItem, "q">[],
  outcomes: readonly Outcome[],
): { wrong: string[]; correct: string[] } {
  const wrong = new Set<string>();
  const correct = new Set<string>();
  items.forEach((item, i) => {
    const outcome = outcomes[i] ?? "blank";
    if (isMistake(outcome)) wrong.add(item.q);
    else correct.add(item.q);
  });
  for (const q of wrong) correct.delete(q);
  return { wrong: [...wrong], correct: [...correct] };
}

/**
 * One answer applied to a question's mistake state (null: none yet). The
 * submit transaction does the same in SQL; the migration rebuild (10 §4)
 * replays history with this.
 */
export function nextMistake(
  prev: MistakeState | null,
  outcome: Outcome,
): MistakeState | null {
  if (isMistake(outcome))
    return {
      wrongCount: (prev?.wrongCount ?? 0) + 1,
      correctStreak: 0,
      status: "open",
    };
  if (!prev || prev.status === "resolved") return prev;
  const correctStreak = prev.correctStreak + 1;
  return {
    ...prev,
    correctStreak,
    status: correctStreak >= RESOLVE_STREAK ? "resolved" : "open",
  };
}
