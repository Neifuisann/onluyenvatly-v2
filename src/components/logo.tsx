import { Atom } from "lucide-react";
import Link from "next/link";
import { shellCopy } from "@/lib/messages";
import { cn } from "@/lib/utils";

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
        "inline-flex min-h-11 items-center gap-2 rounded-md font-semibold text-foreground",
        className,
      )}
    >
      <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Atom aria-hidden className="size-5" strokeWidth={1.75} />
      </span>
      <span
        className={cn(
          "whitespace-nowrap text-base leading-tight",
          narrow && "max-[420px]:sr-only",
        )}
      >
        {shellCopy.appName}
      </span>
    </Link>
  );
}
