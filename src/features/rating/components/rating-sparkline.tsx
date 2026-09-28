import { cn } from "@/lib/utils";
import { sparklinePoints } from "../domain/sparkline";
import { formatRating, ratingCopy } from "../messages";

const W = 160;
const H = 40;

/**
 * Server-rendered SVG line of the latest ratings (07 §5.1): no chart JS on
 * the dashboard. Screen readers get the values as text.
 */
export function RatingSparkline({
  values,
  className,
}: {
  values: readonly number[];
  className?: string;
}) {
  if (values.length < 2) return null;
  const points = sparklinePoints(values, W, H, 4);
  const last = points.split(" ").at(-1)?.split(",");
  return (
    <svg
      role="img"
      aria-label={ratingCopy.sparkline(values.map(formatRating).join(", "))}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("h-10 w-full text-primary", className)}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {last && (
        // A round-capped dot that stays round under preserveAspectRatio="none".
        <line
          x1={last[0]}
          y1={last[1]}
          x2={last[0]}
          y2={last[1]}
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
