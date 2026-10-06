"use client";

import { clsx } from "clsx";
import { Check, CircleAlert } from "lucide-react";
import { useActionState, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { joinGameAction } from "../../actions";
import { RACER_COLORS, RACERS, type Racer } from "../../domain/rules";
import { colorNames, gameCopy, racerNames } from "../../messages";
import { RACER_BG, RACER_ICONS, RacerChip } from "../racer";

const t = gameCopy.play;

/**
 * Pick a racer and a color, then join (or, from the lobby, change them).
 * Two radio groups, so arrow keys move between choices; the big preview
 * shows the result. Works as a plain form before hydration.
 */
export function JoinForm({
  roomId,
  initial,
  submitLabel = t.join,
  onDone,
}: {
  roomId: string;
  initial: { racer: string; color: number };
  submitLabel?: string;
  onDone?: () => void;
}) {
  const [racer, setRacer] = useState(initial.racer as Racer);
  const [color, setColor] = useState(initial.color);
  const [state, action, pending] = useActionState(
    async (prev: Parameters<typeof joinGameAction>[0], data: FormData) => {
      const result = await joinGameAction(prev, data);
      if (result?.ok) onDone?.();
      return result;
    },
    null,
  );
  const failed = state && !state.ok ? state : null;
  return (
    <form action={action} className="grid w-full gap-6">
      <input type="hidden" name="roomId" value={roomId} />
      <div className="flex justify-center">
        <RacerChip
          racer={racer}
          color={color}
          size="xl"
          className="animate-bob"
        />
      </div>
      <fieldset className="grid gap-3">
        <legend className="mb-3 font-semibold text-ink-muted text-sm">
          {t.racerLabel}
        </legend>
        <div className="grid grid-cols-4 gap-2">
          {RACERS.map((r) => {
            const Icon = RACER_ICONS[r];
            const on = r === racer;
            return (
              <label
                key={r}
                className={clsx(
                  "flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 text-xs transition-[background-color,border-color,transform] duration-150 active:scale-95 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
                  on
                    ? "border-accent bg-lane text-ink-foreground"
                    : "border-transparent bg-lane/50 text-ink-muted hover:bg-lane",
                )}
              >
                <input
                  type="radio"
                  name="racer"
                  value={r}
                  checked={on}
                  onChange={() => setRacer(r)}
                  className="sr-only"
                />
                <Icon aria-hidden className="size-7" strokeWidth={2} />
                {racerNames[r]}
              </label>
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-3 font-semibold text-ink-muted text-sm">
          {t.colorLabel}
        </legend>
        <div className="flex flex-wrap justify-center gap-2.5">
          {Array.from({ length: RACER_COLORS }, (_, c) => {
            const on = c === color;
            return (
              <label
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed palette order
                key={c}
                className={clsx(
                  "flex size-11 cursor-pointer items-center justify-center rounded-full text-racer-ink ring-offset-2 ring-offset-ink transition-transform duration-150 active:scale-90",
                  RACER_BG[c],
                  on
                    ? "scale-110 ring-2 ring-accent"
                    : "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink-foreground",
                )}
              >
                <input
                  type="radio"
                  name="color"
                  value={c}
                  checked={on}
                  onChange={() => setColor(c)}
                  className="sr-only"
                />
                <span className="sr-only">{colorNames[c]}</span>
                {on && <Check aria-hidden className="size-5" strokeWidth={3} />}
              </label>
            );
          })}
        </div>
      </fieldset>
      {failed && (
        <p
          role="alert"
          className="flex gap-3 rounded-md bg-danger-soft p-3.5 text-danger-text text-sm"
        >
          <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          {failed.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        aria-disabled={pending}
        className={buttonVariants({ variant: "accent", size: "xl" })}
      >
        {pending ? t.joining : submitLabel}
      </button>
    </form>
  );
}
