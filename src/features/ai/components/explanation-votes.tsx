"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { voteExplanation } from "../actions";
import type { Vote } from "../domain/explain";
import { explainCopy as t } from "../messages";

type Counts = { votesUp: number; votesDown: number; vote: Vote };

/** 👍/👎 on an AI explanation (S7-02); pressing the same one again clears it. */
export function ExplanationVotes({
  hash,
  ...initial
}: Counts & { hash: string }) {
  const [counts, setCounts] = useState<Counts>(initial);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const press = (side: "up" | "down") =>
    startTransition(async () => {
      setError(false);
      const result = await voteExplanation({
        hash,
        vote: counts.vote === side ? null : side,
      });
      if (result.ok) setCounts(result.data);
      else setError(true);
    });

  const buttons = [
    { side: "up", label: t.up, Icon: ThumbsUp, count: counts.votesUp },
    { side: "down", label: t.down, Icon: ThumbsDown, count: counts.votesDown },
  ] as const;
  return (
    <fieldset className="flex flex-col gap-1.5 text-sm">
      <legend className="mb-1.5 text-muted-foreground">{t.voteLabel}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {buttons.map(({ side, label, Icon, count }) => (
          <button
            key={side}
            type="button"
            aria-pressed={counts.vote === side}
            aria-label={`${label} (${count})`}
            disabled={pending}
            onClick={() => press(side)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full border bg-surface px-3 tabular-nums transition-colors duration-150 hover:border-primary/60 disabled:opacity-60",
              counts.vote === side &&
                "border-primary bg-primary text-primary-foreground hover:border-primary",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {count}
          </button>
        ))}
        {error && (
          <span role="alert" className="text-danger-text">
            {t.voteFailed}
          </span>
        )}
      </div>
    </fieldset>
  );
}
