import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Standing } from "../domain/standings";
import { gameCopy } from "../messages";
import { RACER_BG, RacerChip } from "./racer";

const t = gameCopy.play;

/** Second, first, third: the classic podium order, tallest in the middle. */
const STEPS = [
  { place: 1, height: "h-24 sm:h-32", delay: "300ms" },
  { place: 0, height: "h-32 sm:h-44", delay: "700ms" },
  { place: 2, height: "h-16 sm:h-24", delay: "0ms" },
];

/**
 * The top three rise one after the other, third first. Ties keep their
 * shared rank number. With reduced motion everything is simply there.
 */
export function Podium({
  players,
  meId = null,
  label,
}: {
  players: readonly Standing[];
  meId?: number | null;
  label: string;
}) {
  return (
    <ol
      aria-label={label}
      className="mx-auto grid w-full max-w-xl grid-cols-3 items-end gap-2 sm:gap-4"
    >
      {STEPS.map(({ place, height, delay }) => {
        const p = players[place];
        if (!p) return <li key={place} aria-hidden />;
        return (
          <li
            key={p.id}
            className="flex animate-rise flex-col items-center gap-2 text-center"
            style={{ animationDelay: delay }}
          >
            {place === 0 && (
              <Crown aria-hidden className="size-8 fill-accent text-accent" />
            )}
            <RacerChip
              racer={p.racer}
              color={p.color}
              size={place === 0 ? "lg" : "md"}
              className={cn(place === 0 && "animate-bob")}
            />
            <span
              className={cn(
                "line-clamp-2 max-w-full break-words font-semibold text-ink-foreground text-sm sm:text-base",
                p.id === meId && "text-accent",
              )}
            >
              {p.id === meId ? `${p.name} (${t.you})` : p.name}
            </span>
            <span className="num font-display text-ink-muted text-sm">
              {t.points(p.score)}
            </span>
            <span
              className={cn(
                "flex w-full items-start justify-center rounded-t-lg pt-2 font-bold font-display text-3xl text-racer-ink sm:text-4xl",
                RACER_BG[p.color] ?? RACER_BG[0],
                height,
              )}
            >
              <span className="sr-only">{t.rank(p.rank)}: </span>
              <span aria-hidden>{p.rank}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const PIECES = Array.from({ length: 36 }, (_, i) => ({
  key: i,
  left: `${(i * 37) % 100}%`,
  delay: `${((i * 13) % 20) / 10}s`,
  color: RACER_BG[i % RACER_BG.length],
  wide: i % 3 === 0,
}));

/** One burst of paper confetti over the podium. Decorative. */
export function Confetti() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden motion-reduce:hidden"
    >
      {PIECES.map((p) => (
        <span
          key={p.key}
          className={cn(
            "absolute top-0 block animate-confetti rounded-[2px] opacity-0",
            p.color,
            p.wide ? "h-2 w-3" : "h-3 w-1.5",
          )}
          style={{ left: p.left, animationDelay: p.delay }}
        />
      ))}
    </div>
  );
}
