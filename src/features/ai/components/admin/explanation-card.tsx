import { BadgeCheck, Flag, ThumbsDown, ThumbsUp } from "lucide-react";
import { MathText } from "@/components/math-text/math-text";
import type { AdminExplanation } from "../../admin-queries";
import { isFlagged } from "../../domain/explain";
import { adminExplanationsCopy as t } from "../../messages";
import { ExplanationActions } from "./explanation-actions";

/** A stored explanation with its badges, votes and actions (S7-03). */
export function ExplanationCard({
  explanation: e,
}: {
  explanation: AdminExplanation;
}) {
  const reviewed = e.reviewedAt !== null;
  return (
    <div className="flex flex-col gap-3 rounded-md bg-muted p-3 text-sm">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="font-medium">
          {e.source === "teacher" ? t.sourceTeacher : t.sourceAi(e.model)}
        </span>
        {reviewed && (
          <span className="inline-flex items-center gap-1 text-success-text">
            <BadgeCheck aria-hidden className="size-3.5" />
            {t.reviewed}
          </span>
        )}
        {isFlagged(e) && (
          <span className="inline-flex items-center gap-1 text-danger-text">
            <Flag aria-hidden className="size-3.5" />
            {t.flagged}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-muted-foreground tabular-nums">
          <ThumbsUp aria-hidden className="size-3.5" />
          <ThumbsDown aria-hidden className="size-3.5" />
          {t.votes(e.votesUp, e.votesDown)}
        </span>
      </p>
      <MathText text={e.contentMd} />
      <ExplanationActions
        // Remount after a save or a regeneration so the form starts fresh.
        key={e.updatedAt.toISOString()}
        hash={e.hash}
        contentMd={e.contentMd}
        reviewed={reviewed}
      />
    </div>
  );
}
