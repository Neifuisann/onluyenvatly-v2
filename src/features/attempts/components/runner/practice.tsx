"use client";

import { CircleCheck, CircleHelp, CircleX } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useContext,
  useState,
  useTransition,
} from "react";
import { Button } from "@/components/ui/button";
import type { AttemptAnswer } from "@/db/schema";
import type { PracticeFeedback } from "@/features/review/domain/practice";
import { formatScore } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { checkPracticeAnswer } from "../../actions";
import { isAnswered } from "../../domain/runner-state";
import { practiceCopy as t } from "../../messages";
import { useRunner, useRunnerApi } from "./store";

/**
 * The runner in practice mode (01 Q9, S7-06; review attempts): under each
 * question a "Kiểm tra" button asks the server how the answer scores and
 * what the key is. A checked answer is locked here and on the server.
 */
export type RunnerPractice = {
  /** Feedback of the items already checked, restored after a reload. */
  checked: Record<number, PracticeFeedback>;
};

type PracticeState = {
  feedback: Record<number, PracticeFeedback>;
  pending: number | null;
  errors: Record<number, string>;
  check: (index: number) => void;
};

const PracticeContext = createContext<PracticeState | null>(null);
export const usePractice = () => useContext(PracticeContext);

export function PracticeProvider({
  attemptId,
  practice,
  children,
}: {
  attemptId: string;
  practice: RunnerPractice;
  children: ReactNode;
}) {
  const api = useRunnerApi();
  const [feedback, setFeedback] = useState(practice.checked);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [pending, setPending] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const check = (index: number) => {
    const answer = api.getState().answers[index] ?? null;
    setPending(index);
    setErrors(({ [index]: _, ...rest }) => rest);
    startTransition(async () => {
      try {
        const result = await checkPracticeAnswer({ attemptId, index, answer });
        if (result.ok) {
          api.getState().lock(index);
          setFeedback((f) => ({ ...f, [index]: result.data }));
        } else setErrors((e) => ({ ...e, [index]: result.message }));
      } catch {
        setErrors((e) => ({ ...e, [index]: t.failed }));
      } finally {
        setPending(null);
      }
    });
  };

  return (
    <PracticeContext.Provider value={{ feedback, pending, errors, check }}>
      {children}
    </PracticeContext.Provider>
  );
}

const LETTERS = "abcdefgh";

/** The key in the student's display terms. */
function keyText(expected: AttemptAnswer): string {
  if (Array.isArray(expected))
    return t.keyTf(
      expected
        .map((v, i) => `${LETTERS[i]}) ${v ? t.true : t.false}`)
        .join(" · "),
    );
  // Short answers read with a decimal comma, as students type them.
  return t.key(String(expected ?? "—").replace(".", ","));
}

const tone = {
  correct: "border-success/40 bg-success/10",
  partial: "border-warning bg-warning/15",
  wrong: "border-danger/40 bg-danger/10",
  blank: "bg-muted",
} as const;

const Icon = {
  correct: CircleCheck,
  partial: CircleHelp,
  wrong: CircleX,
  blank: CircleHelp,
} as const;

/** Under a question in practice mode: "Kiểm tra", then the feedback. */
export function PracticeCheck({ index }: { index: number }) {
  const practice = usePractice();
  const answer = useRunner((s) => s.answers[index]);
  if (!practice) return null;
  const f = practice.feedback[index];
  const error = practice.errors[index];
  if (f) {
    const OutcomeIcon = Icon[f.outcome];
    return (
      <div
        className={cn(
          "space-y-1 rounded-md border p-3 text-sm",
          tone[f.outcome],
        )}
      >
        <p className="flex items-center gap-2 font-medium">
          <OutcomeIcon aria-hidden className="size-4 shrink-0" />
          {f.outcome === "partial"
            ? t.outcome.partial(formatScore(f.earned), formatScore(f.max))
            : t.outcome[f.outcome]}
        </p>
        <p>{keyText(f.expected)}</p>
        <p className="text-muted-foreground">{t.later}</p>
      </div>
    );
  }
  const busy = practice.pending === index;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="secondary"
        onClick={() => practice.check(index)}
        disabled={busy || practice.pending !== null || !isAnswered(answer)}
      >
        {busy ? t.checking : t.check}
      </Button>
      <p aria-live="polite" className="text-sm">
        {error ? (
          <span className="text-danger-text">{error}</span>
        ) : (
          !isAnswered(answer) && (
            <span className="text-muted-foreground">{t.answerFirst}</span>
          )
        )}
      </p>
    </div>
  );
}
