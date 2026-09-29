import { questionTypeLabels } from "@/features/lessons/messages";
import type { AccuracyEntry } from "../domain/profile";
import { profileCopy as t } from "../messages";

const percent = (x: number) => `${Math.round(x * 100)}%`;

/**
 * Accuracy per question type or chapter as plain CSS bars: the number is the
 * text, the bar only illustrates it (no chart JS needed).
 */
export function AccuracyBars<K extends string>({
  title,
  entries,
  label = (k) => k,
}: {
  title: string;
  entries: readonly AccuracyEntry<K>[];
  label?: (key: K) => string;
}) {
  if (!entries.length) return null;
  return (
    <div className="space-y-3">
      <h3 className="font-medium text-sm">{title}</h3>
      <ul className="space-y-3">
        {entries.map((e) => (
          <li key={e.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{label(e.key)}</span>
              <span className="shrink-0 text-muted-foreground">
                <span className="num font-semibold text-foreground tabular-nums">
                  {percent(e.accuracy)}
                </span>{" "}
                · {t.questionsCount(e.questions)}
              </span>
            </div>
            <div
              aria-hidden
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: percent(e.accuracy) }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const typeLabel = (k: keyof typeof questionTypeLabels) =>
  questionTypeLabels[k];
