import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gameCopy } from "../messages";
import { RacerChip } from "./racer";

const t = gameCopy.play;

/**
 * Dashboard entry to a class race (B-05): type the PIN right here. A plain
 * GET form to `/play`, which checks it and opens the room.
 */
export function JoinBanner() {
  return (
    <section
      aria-labelledby="join-game-heading"
      className="flex flex-col gap-4 rounded-xl bg-ink p-5 text-ink-foreground shadow-card sm:flex-row sm:items-center sm:p-6"
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span aria-hidden className="relative hidden shrink-0 sm:block">
          <RacerChip racer="rabbit" color={2} size="lg" />
          <Flag className="absolute -right-2 -bottom-1 size-6 fill-accent text-accent" />
        </span>
        <div className="min-w-0 space-y-0.5">
          <h2 id="join-game-heading" className="heading-section">
            {t.dashboardTitle}
          </h2>
          <p className="text-ink-muted text-sm">{t.dashboardBody}</p>
        </div>
      </div>
      <form method="get" action="/play" className="flex gap-2">
        <label htmlFor="dashboard-pin" className="sr-only">
          {t.pinLabel}
        </label>
        <input
          id="dashboard-pin"
          name="pin"
          required
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          placeholder={t.pinPlaceholder}
          className="num h-11 w-full min-w-0 rounded-full bg-ink-foreground px-4 text-center font-bold font-display text-ink text-lg tracking-[0.2em] placeholder:text-ink/40 focus-visible:outline-accent sm:w-40"
        />
        <Button type="submit" variant="accent">
          {t.enter}
        </Button>
      </form>
    </section>
  );
}
