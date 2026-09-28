import { cn } from "@/lib/utils";
import { type Tier, tierOf } from "../domain/rating";
import { ratingCopy, tierNames } from "../messages";

const dot: Record<Tier, string> = {
  bronze: "bg-tier-bronze",
  silver: "bg-tier-silver",
  gold: "bg-tier-gold",
  platinum: "bg-tier-platinum",
  diamond: "bg-tier-diamond",
  master: "bg-tier-master",
};

/**
 * Tier chip. The tier color is only a dot next to the name, so the text keeps
 * full contrast in both themes.
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
        "inline-flex items-center gap-1.5 rounded-full border bg-surface px-2.5 py-0.5 font-medium text-xs",
        className,
      )}
    >
      <span aria-hidden className={cn("size-2.5 rounded-full", dot[tier])} />
      <span className="sr-only">{ratingCopy.tierPrefix}</span>
      {tierNames[tier]}
    </span>
  );
}
