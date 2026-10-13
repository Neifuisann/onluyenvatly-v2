"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";

/**
 * Icons, labels and styles are rendered by the server; only selection hydrates.
 * Prefetch on intent (hover, focus): the prerendered shell up to `loading.tsx`,
 * a static file from the CDN (no function, no query), so a click shows the next
 * page's skeleton at once. Prefetching every nav link on every page view was a
 * fifth of all CDN requests (08 §4).
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
  const [intent, setIntent] = useState(false);
  const prefetch = () => setIntent(true);
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      prefetch={intent ? null : false}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={active ? selectedClassName : className}
    >
      {children}
    </Link>
  );
}
