import type { ReactNode } from "react";
import type { QuestionType } from "@/features/lessons/schema";

/**
 * What the runner gets per item: answer-free, already in display order, with
 * text pre-rendered on the server (MathText/KaTeX never ships to the client).
 */
export type RunnerQuestion = {
  type: QuestionType;
  points: number;
  stem: ReactNode;
  /** mcq, in display order (the attempt's option order applied). */
  options?: ReactNode[];
  /** tf, a–h order. */
  statements?: ReactNode[];
};
