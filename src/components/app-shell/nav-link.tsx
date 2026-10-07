"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Icons, labels and styles are rendered by the server; only selection hydrates.
 * Default prefetch: for these PPR routes that is the prerendered shell up to
 * `loading.tsx`, a static file from the CDN (no function, no query), so a tap
 * shows the next page's skeleton at once instead of waiting for the server.
 */
export function NavLink({
  href,
  exact,
  label,
  className,
  selectedClassName,
  children,
}: {
  href: string;
  exact?: boolean | undefined;
  label?: string | undefined;
  className: string;
  selectedClassName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={active ? selectedClassName : className}
    >
      {children}
    </Link>
  );
}
