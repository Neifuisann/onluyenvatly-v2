"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { explainCopy as t } from "../messages";

type State =
  | { kind: "idle" }
  | { kind: "streaming"; text: string }
  | { kind: "error"; message: string };

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown };
    return typeof body.message === "string" ? body.message : t.failed;
  } catch {
    return t.failed;
  }
}

/**
 * "Giải thích bằng AI" (S7-02): streams a new explanation as plain text,
 * then refreshes the page, which renders the stored one with formulas
 * (KaTeX stays on the server). A cached one skips straight to the refresh.
 */
export function ExplainButton({
  attemptId,
  index,
}: {
  attemptId: string;
  index: number;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [refreshing, startRefresh] = useTransition();

  async function ask() {
    setState({ kind: "streaming", text: "" });
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attemptId, index }),
      });
      if (!res.ok || !res.body) {
        setState({ kind: "error", message: await errorMessage(res) });
        return;
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += value;
        setState({ kind: "streaming", text });
      }
      startRefresh(() => router.refresh());
    } catch {
      setState({ kind: "error", message: t.failed });
    }
  }

  const busy = state.kind === "streaming" || refreshing;
  return (
    <section className="flex flex-col gap-2" aria-label={t.heading}>
      {state.kind !== "streaming" && !refreshing && (
        <Button variant="secondary" size="sm" className="w-fit" onClick={ask}>
          <Sparkles aria-hidden />
          {state.kind === "error" ? t.retry : t.ask}
        </Button>
      )}
      <div aria-live="polite" aria-busy={busy} className="text-sm">
        {busy && (
          <div className="rounded-md bg-muted p-3">
            <p className="mb-1 font-medium">{t.generating}</p>
            {state.kind === "streaming" && state.text && (
              <p className="whitespace-pre-wrap break-words text-muted-foreground">
                {state.text}
              </p>
            )}
          </div>
        )}
        {state.kind === "error" && (
          <p className="text-danger-text">{state.message}</p>
        )}
      </div>
    </section>
  );
}
