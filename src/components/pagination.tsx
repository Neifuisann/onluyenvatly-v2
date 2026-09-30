import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { paginationCopy as t } from "@/lib/messages";
import { pageWindow } from "@/lib/pagination";
import { cn } from "@/lib/utils";

const itemClass =
  "num inline-flex size-10 items-center justify-center rounded-full font-semibold text-sm transition-[background-color,color,box-shadow] duration-150";

/**
 * Numbered pages as links (the URL is the state). Server component: `href`
 * builds each page's URL. "Trước/Sau" collapse to arrows on phones.
 */
export function Pagination({
  page,
  pageCount,
  href,
  className,
}: {
  page: number;
  pageCount: number;
  href: (page: number) => string;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  const edge = (to: number, disabled: boolean, next: boolean) => {
    const Icon = next ? ChevronRight : ChevronLeft;
    const label = next ? t.next : t.previous;
    const body = (
      <>
        {!next && <Icon aria-hidden className="size-4" />}
        <span className="max-sm:sr-only">{label}</span>
        {next && <Icon aria-hidden className="size-4" />}
      </>
    );
    const cls =
      "inline-flex h-10 items-center gap-1 rounded-full px-3 font-semibold text-sm transition-colors duration-150";
    return disabled ? (
      <span aria-disabled className={cn(cls, "text-muted-foreground/50")}>
        {body}
      </span>
    ) : (
      <Link
        href={href(to)}
        prefetch={false}
        rel={next ? "next" : "prev"}
        className={cn(cls, "text-foreground hover:bg-muted")}
      >
        {body}
      </Link>
    );
  };
  return (
    <nav
      aria-label={t.label}
      className={cn("flex items-center justify-center gap-1", className)}
    >
      {edge(page - 1, page <= 1, false)}
      <ul className="flex items-center gap-1">
        {pageWindow(page, pageCount).map((p, i) =>
          p === null ? (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: at most two gaps, fixed slots
              key={`gap-${i}`}
              aria-hidden
              className="w-6 text-center text-muted-foreground"
            >
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={href(p)}
                prefetch={false}
                aria-label={t.page(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  itemClass,
                  p === page
                    ? "bg-primary text-primary-foreground shadow-card"
                    : "text-foreground hover:bg-muted",
                )}
              >
                {p}
              </Link>
            </li>
          ),
        )}
      </ul>
      {edge(page + 1, page >= pageCount, true)}
    </nav>
  );
}
