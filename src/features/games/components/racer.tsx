import { clsx } from "clsx";
import {
  Bike,
  CarFront,
  Cat,
  type LucideIcon,
  Plane,
  Rabbit,
  Rocket,
  Sailboat,
  Turtle,
} from "lucide-react";
import type { Racer } from "../domain/rules";

/*
 * Game components on phones use `clsx`, not `cn`: tailwind-merge alone is
 * 8 KB of the 150 KB student budget (S9-02). Conflicting classes are chosen
 * with props and ternaries instead of overrides.
 */

export const RACER_ICONS: Record<Racer, LucideIcon> = {
  rabbit: Rabbit,
  rocket: Rocket,
  car: CarFront,
  bike: Bike,
  plane: Plane,
  sailboat: Sailboat,
  turtle: Turtle,
  cat: Cat,
};

/** Literal class names, so Tailwind sees every racer color. */
export const RACER_BG = [
  "bg-racer-0",
  "bg-racer-1",
  "bg-racer-2",
  "bg-racer-3",
  "bg-racer-4",
  "bg-racer-5",
  "bg-racer-6",
  "bg-racer-7",
] as const;

const SIZES = {
  sm: "size-7 [&>svg]:size-4",
  md: "size-10 [&>svg]:size-5",
  lg: "size-16 [&>svg]:size-8",
  xl: "size-28 [&>svg]:size-14",
} as const;

const OUTLINES = {
  /** A soft inner edge, the default. */
  none: "ring-2 ring-racer-ink/15 ring-inset",
  /** Crossed the line, or the player's own racer. */
  accent: "ring-3 ring-accent",
  /** Overlapping chips on the stage. */
  ink: "ring-2 ring-ink",
} as const;

/** A player's racer: their icon on their color. Decorative; names carry meaning. */
export function RacerChip({
  racer,
  color,
  size = "md",
  outline = "none",
  className,
}: {
  racer: string;
  color: number;
  size?: keyof typeof SIZES;
  outline?: keyof typeof OUTLINES;
  /** Layout and motion only (`animate-bob`): never colors or rings. */
  className?: string | undefined;
}) {
  const Icon = RACER_ICONS[racer as Racer] ?? Rabbit;
  return (
    <span
      aria-hidden
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full text-racer-ink",
        RACER_BG[color] ?? RACER_BG[0],
        SIZES[size],
        OUTLINES[outline],
        className,
      )}
    >
      <Icon strokeWidth={2.25} />
    </span>
  );
}
