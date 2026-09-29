"use client";

import { Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { pregenerateExplanations } from "../../admin-actions";
import { PREGEN_INTERVAL_MS } from "../../domain/pregenerate";
import { adminExplanationsCopy as t } from "../../messages";

type Run =
  | { kind: "idle" }
  | { kind: "running"; done: number; left: number }
  | { kind: "finished"; done: number; skipped: number; stopped: boolean }
  | { kind: "error"; done: number; message: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * "Tạo giải thích cho N câu" (S7-03): calls the one-question action again
 * and again, one call every `PREGEN_INTERVAL_MS`, so the free-tier
 * per-minute limit holds. Each generated explanation refreshes the list
 * below. Stops on "Dừng", an error (quota, AI off) or when nothing is left.
 */
export function PregeneratePanel({
  lessonId,
  missing,
  aiEnabled,
}: {
  lessonId: number;
  missing: number;
  aiEnabled: boolean;
}) {
  const [run, setRun] = useState<Run>({ kind: "idle" });
  const stopRef = useRef(false);
  // Leaving the page stops the loop.
  useEffect(
    () => () => {
      stopRef.current = true;
    },
    [],
  );

  async function start() {
    stopRef.current = false;
    const skip: string[] = [];
    let done = 0;
    let left = missing;
    setRun({ kind: "running", done, left });
    while (true) {
      const started = Date.now();
      const result = await pregenerateExplanations({ lessonId, skip });
      if (!result.ok) {
        setRun({ kind: "error", done, message: result.message });
        return;
      }
      const step = result.data;
      if (step.questionId === null) {
        left = 0;
        break;
      }
      if (step.generated) done++;
      else skip.push(step.questionId);
      left = step.remaining;
      if (left === 0 || stopRef.current) break;
      setRun({ kind: "running", done, left });
      await sleep(Math.max(0, PREGEN_INTERVAL_MS - (Date.now() - started)));
      if (stopRef.current) break;
    }
    setRun({
      kind: "finished",
      done,
      skipped: skip.length,
      stopped: left > 0,
    });
  }

  const running = run.kind === "running";
  return (
    <section
      aria-labelledby="pregen-heading"
      className="flex flex-col gap-3 rounded-lg border border-border/70 bg-surface p-5 shadow-card dark:border-border"
    >
      <h2 id="pregen-heading" className="font-semibold">
        {t.pregenTitle}
      </h2>
      <p className="text-muted-foreground text-sm">{t.pregenLead(missing)}</p>
      {!aiEnabled && <p className="text-sm">{t.aiOff}</p>}
      {running ? (
        <Button
          variant="secondary"
          className="w-fit"
          onClick={() => {
            stopRef.current = true;
          }}
        >
          <Square aria-hidden />
          {t.pregenStop}
        </Button>
      ) : (
        missing > 0 &&
        aiEnabled && (
          <Button className="w-fit" onClick={start}>
            <Sparkles aria-hidden />
            {t.pregenStart(missing)}
          </Button>
        )
      )}
      <output aria-live="polite" className="flex flex-col gap-1 text-sm">
        {run.kind === "running" && (
          <span>{t.pregenProgress(run.done, run.left)}</span>
        )}
        {run.kind === "finished" && (
          <>
            <span>
              {run.stopped ? t.pregenStopped(run.done) : t.pregenDone(run.done)}
            </span>
            {run.skipped > 0 && <span>{t.pregenSkipped(run.skipped)}</span>}
          </>
        )}
        {run.kind === "error" && (
          <span className="text-danger-text">
            {run.done > 0 && `${t.pregenStopped(run.done)} `}
            {run.message}
          </span>
        )}
      </output>
    </section>
  );
}
