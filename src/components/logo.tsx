import Link from "next/link";
import { shellCopy } from "@/lib/messages";
import { cn } from "@/lib/utils";

/** The brand mark: the Physics Bunny's head with its atom orbit. */
export function LogoMark({ className }: { className?: string }) {
  return (
    // Pre-sized static art (160 px WebP), see scripts/optimize-mascot.ts.
    // biome-ignore lint/performance/noImgElement: ADR-006, no optimization quota for static art
    <img
      src="/brand/mark.webp"
      alt=""
      aria-hidden
      width={40}
      height={40}
      draggable={false}
      className={cn("size-10 shrink-0 select-none", className)}
    />
  );
}

export function Logo({
  href = "/",
  className,
  narrow = false,
}: {
  href?: string;
  className?: string;
  /** Hide the wordmark on very small screens (it stays for screen readers). */
  narrow?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-2.5 rounded-md text-foreground",
        className,
      )}
    >
      <LogoMark />
      <span
        className={cn(
          "whitespace-nowrap font-bold font-display text-[1.0625rem] leading-tight tracking-tight",
          narrow && "max-[420px]:sr-only",
        )}
      >
        {shellCopy.appName}
      </span>
    </Link>
  );
}
