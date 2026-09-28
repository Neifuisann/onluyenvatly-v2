import { Fragment } from "react";
import { MathText } from "@/components/math-text/math-text";
import { QuestionImage } from "@/components/math-text/question-image";
import type { PublicQuestion } from "@/features/lessons/domain/public-question";
import type { RunnerQuestion } from "./types";

/**
 * Server side: turns an answer-free question (options already in the
 * attempt's order) into pre-rendered runner content.
 */
export function toRunnerQuestion(
  q: PublicQuestion,
  points: number,
): RunnerQuestion {
  const stem = (
    <>
      <MathText text={q.stem} />
      {q.image && <QuestionImage media={q.image} />}
    </>
  );
  switch (q.type) {
    case "mcq":
      return {
        type: "mcq",
        points,
        stem,
        // Keys only satisfy the linter: each entry is rendered on its own.
        options: q.options.map((o, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed display order
          <Fragment key={i}>
            <MathText text={o.text} />
            {o.image && <QuestionImage media={o.image} />}
          </Fragment>
        )),
      };
    case "tf":
      return {
        type: "tf",
        points,
        stem,
        statements: q.statements.map((s, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed a–h order
          <MathText key={i} text={s.text} />
        )),
      };
    case "short":
      return { type: "short", points, stem };
  }
}
