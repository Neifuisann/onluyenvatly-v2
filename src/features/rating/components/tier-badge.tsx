import { cn } from "@/lib/utils";
import { type Tier, tierOf } from "../domain/rating";
import { ratingCopy, tierNames } from "../messages";

/**
 * The tier's emblem (public/tiers, 128 px WebP). Decorative: the tier name is
 * always written next to it.
 */
export function TierEmblem({
  tier,
  size = 20,
  className,
}: {
  tier: Tier;
  size?: number;
  className?: string;
}) {
  return (
    // Pre-sized static art; no image-optimization quota (ADR-006).
    // biome-ignore lint/performance/noImgElement: see ADR-006
    <img
      src={`/tiers/${tier}.webp`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      draggable={false}
      className={cn("shrink-0 select-none", className)}
    />
  );
}

/**
 * Tier chip: emblem + name. The name carries the meaning, so the text keeps
 * full contrast in both themes and color is never the only signal.
 */
export function TierBadge({
  rating,
  className,
}: {
  rating: number;
  className?: string;
}) {
  const tier = tierOf(rating);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-surface py-0.5 pr-2.5 pl-1 font-semibold text-xs",
        className,
      )}
    >
      <TierEmblem tier={tier} size={18} />
      <span className="sr-only">{ratingCopy.tierPrefix}</span>
      {tierNames[tier]}
    </span>
  );
}
