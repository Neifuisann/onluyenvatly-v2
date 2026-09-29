import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDelta, ratingCopy } from "../messages";

/**
 * A rating change: arrow + sign + colour, never colour alone (07 §1). `label`
 * prefixes the screen-reader text ("7 ngày: tăng 32").
 */
export function RatingDelta({
  value,
  label,
  strong,
}: {
  value: number;
  label?: string;
  strong?: boolean;
}) {
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 num",
        strong ? "rounded-full px-2 py-0.5 font-semibold text-sm" : "text-xs",
        value > 0 && "text-success-text",
        value < 0 && "text-danger-text",
        value === 0 && "text-muted-foreground",
        strong && value > 0 && "bg-success-soft",
        strong && value < 0 && "bg-danger-soft",
        strong && value === 0 && "bg-muted",
      )}
    >
      {Icon && <Icon aria-hidden className={strong ? "size-4" : "size-3"} />}
      <span className="sr-only">
        {label && `${label}: `}
        {value > 0
          ? ratingCopy.up(value)
          : value < 0
            ? ratingCopy.down(-value)
            : ratingCopy.same}
      </span>
      <span aria-hidden>{formatDelta(value)}</span>
    </span>
  );
}
