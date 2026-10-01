"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Icons, labels and styles are rendered by the server; only selection hydrates. */
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
      prefetch={false}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={active ? selectedClassName : className}
    >
      {children}
    </Link>
  );
}
