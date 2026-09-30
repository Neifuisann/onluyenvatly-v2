import Link from "next/link";
import { cn } from "@/lib/utils";

export type SegmentedItem = {
  key: string;
  href: string;
  label: string;
  /** Shown as a small pill after the label; hidden when 0 or missing. */
  count?: number | undefined;
  active: boolean;
};

/**
 * Link-based segmented control (07 §3.3): a muted track with the current
 * choice on a raised pill, the same shape as the catalog's grade switch.
 * The URL is the state, so each segment is a link with `aria-current`.
 */
export function SegmentedNav({
  label,
  items,
  className,
}: {
  label: string;
  items: readonly SegmentedItem[];
  className?: string;
}) {
  return (
    <ul
      aria-label={label}
      className={cn(
        "flex w-fit max-w-full overflow-x-auto rounded-full bg-muted p-1 [scrollbar-width:none]",
        className,
      )}
    >
      {items.map((item) => (
        <li key={item.key} className="shrink-0">
          <Link
            href={item.href}
            prefetch={false}
            scroll={false}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full px-3.5 font-medium text-sm transition-[background-color,color,box-shadow] duration-150",
              item.active
                ? "bg-surface text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {item.count ? (
              <span
                className={cn(
                  "num inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 font-bold text-[0.6875rem] leading-none",
                  item.active
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface text-foreground",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
