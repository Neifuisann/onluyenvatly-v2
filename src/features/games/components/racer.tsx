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
import { cn } from "@/lib/utils";
import type { Racer } from "../domain/rules";

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

/** A player's racer: their icon on their color. Decorative; names carry meaning. */
export function RacerChip({
  racer,
  color,
  size = "md",
  className,
}: {
  racer: string;
  color: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const Icon = RACER_ICONS[racer as Racer] ?? Rabbit;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full text-racer-ink ring-2 ring-racer-ink/15 ring-inset",
        RACER_BG[color] ?? RACER_BG[0],
        SIZES[size],
        className,
      )}
    >
      <Icon strokeWidth={2.25} />
    </span>
  );
}
