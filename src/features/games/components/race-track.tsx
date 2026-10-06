import { clsx } from "clsx";
import { Flame } from "lucide-react";
import { trackProgress } from "../domain/scoring";
import type { Standing } from "../domain/standings";
import { gameCopy } from "../messages";
import { RacerChip } from "./racer";

const t = gameCopy.play;

const LANE = {
  phone: {
    h: 44,
    gap: 6,
    chip: "sm" as const,
    rank: "w-7",
    name: "w-20 text-sm sm:w-32",
    score: "w-12 text-sm sm:w-16",
  },
  stage: {
    h: 56,
    gap: 8,
    chip: "md" as const,
    rank: "w-9 text-lg",
    name: "w-40 text-base lg:w-52 lg:text-lg",
    score: "w-20 text-lg",
  },
};

/**
 * The race (B-05): one ticker-tape lane per player, ordered by rank. Lanes
 * sit at absolute offsets, so an overtake glides instead of jumping, and a
 * racer's position is its points against a perfect, instant race. A list for
 * screen readers too: each lane reads as rank, name and points.
 */
export function RaceTrack({
  players,
  questionCount,
  meId = null,
  size = "phone",
  label,
}: {
  players: readonly Standing[];
  questionCount: number;
  meId?: number | null;
  size?: keyof typeof LANE;
  label: string;
}) {
  const lane = LANE[size];
  return (
    <ol
      aria-label={label}
      className="relative"
      style={{ height: players.length * (lane.h + lane.gap) - lane.gap }}
    >
      {players.map((p, i) => {
        const progress = trackProgress(p.score, questionCount);
        const me = p.id === meId;
        return (
          <li
            key={p.id}
            className="absolute inset-x-0 flex items-center gap-2 transition-[top] duration-700 ease-out-soft sm:gap-3"
            style={{ top: i * (lane.h + lane.gap), height: lane.h }}
          >
            <span
              className={clsx(
                "num shrink-0 text-center font-bold font-display",
                lane.rank,
                p.rank <= 3 ? "text-accent" : "text-ink-muted",
              )}
            >
              {p.rank}
            </span>
            <span
              className={clsx(
                "shrink-0 truncate font-semibold text-ink-foreground",
                lane.name,
              )}
            >
              {me ? t.you : p.name}
              <span className="sr-only">
                {me && ` (${p.name})`}, {t.points(p.score)}
              </span>
            </span>
            <span
              aria-hidden
              className={clsx(
                "race-lane relative h-full min-w-0 flex-1 overflow-hidden rounded-full",
                me && "ring-2 ring-accent",
              )}
            >
              <span
                className="ticker-tape absolute inset-y-0 left-3 transition-[width] duration-1000 ease-out-soft"
                style={{ width: `calc(${progress * 100}% - 1rem)` }}
              />
              <span className="finish-line absolute inset-y-0 right-0 w-2 opacity-70" />
              <span
                className="absolute top-1/2 flex items-center transition-[left,transform] duration-1000 ease-out-soft"
                style={{
                  left: `${progress * 100}%`,
                  transform: `translate(-${progress * 100}%, -50%)`,
                }}
              >
                <RacerChip
                  racer={p.racer}
                  color={p.color}
                  size={lane.chip}
                  outline={p.finished ? "accent" : "none"}
                />
              </span>
            </span>
            <span
              aria-hidden
              className={clsx(
                "num shrink-0 text-right font-bold font-display text-ink-foreground",
                lane.score,
              )}
            >
              {t.pointsShort(p.score)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** A small flame with the streak length; only from two in a row. */
export function StreakFlame({ streak }: { streak: number }) {
  if (streak < 2) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 font-bold text-accent-foreground text-sm">
      <Flame aria-hidden className="size-4 fill-current" />
      <span className="num">{t.streak(streak)}</span>
    </span>
  );
}
