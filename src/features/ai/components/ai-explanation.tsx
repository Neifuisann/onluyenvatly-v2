import { BadgeCheck, Sparkles } from "lucide-react";
import { MathText } from "@/components/math-text/math-text";
import { explainCopy as t } from "../messages";
import type { ReviewExplanation } from "../queries";
import { ExplainButton } from "./explain-button";
import { ExplanationVotes } from "./explanation-votes";

/**
 * The AI part of a reviewed question (S7-02): the stored explanation
 * (server-rendered, formulas with KaTeX) with votes, or the button that
 * generates it. Only rendered once the result page may show answers, and
 * only for questions without a teacher explanation.
 */
export function AiExplanation({
  attemptId,
  index,
  explanation,
  canAsk,
}: {
  attemptId: string;
  index: number;
  explanation: ReviewExplanation | undefined;
  /** AI switched on: a missing explanation can be generated. */
  canAsk: boolean;
}) {
  if (!explanation)
    return canAsk ? (
      <ExplainButton attemptId={attemptId} index={index} />
    ) : null;
  return (
    <section
      aria-labelledby={`ai-${index}`}
      className="flex flex-col gap-2 rounded-md bg-muted p-3 text-sm"
    >
      <h4
        id={`ai-${index}`}
        className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium"
      >
        <Sparkles aria-hidden className="size-4" />
        {t.heading}
        {explanation.reviewed && (
          <span className="inline-flex items-center gap-1 font-normal text-success-text text-xs">
            <BadgeCheck aria-hidden className="size-3.5" />
            {t.teacherReviewed}
          </span>
        )}
      </h4>
      <MathText text={explanation.contentMd} />
      {!explanation.reviewed && (
        <p className="text-muted-foreground text-xs">{t.disclaimer}</p>
      )}
      <ExplanationVotes
        hash={explanation.hash}
        votesUp={explanation.votesUp}
        votesDown={explanation.votesDown}
        vote={explanation.vote}
      />
    </section>
  );
}
