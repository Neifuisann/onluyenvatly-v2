"use client";

import { Input } from "@/components/ui/input";
import { normalizeShortAnswer } from "@/features/grading/domain/short-answer";
import { runnerCopy as t } from "../../messages";
import { useRunner } from "./store";

/**
 * Numeric keyboard on phones; accepts `,` and `.` and shows how the server
 * will read the answer when that differs from what was typed (07 §4).
 */
export function ShortAnswerInput({ index }: { index: number }) {
  const answer = useRunner((s) => s.answers[index]);
  const setText = useRunner((s) => s.setText);
  const text = typeof answer === "string" ? answer : "";
  const readAs = normalizeShortAnswer(text);
  const id = `short-${index}`;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="font-semibold text-sm">
        {t.shortLabel}
      </label>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={100}
        placeholder={t.shortPlaceholder}
        aria-describedby={`${id}-hint`}
        value={text}
        onChange={(e) => setText(index, e.target.value)}
        className="num h-14 max-w-sm font-display font-semibold text-xl"
      />
      <p id={`${id}-hint`} className="text-muted-foreground text-sm">
        {readAs !== "" && readAs !== text.trim()
          ? t.shortReadAs(readAs)
          : t.shortHint}
      </p>
    </div>
  );
}
