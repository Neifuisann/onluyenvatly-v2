import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { publicCopy as t } from "@/lib/messages";

const LINKS = [
  { href: "/ly-thuyet", label: t.footerLinks.theory },
  { href: "/gallery", label: t.footerLinks.gallery },
  { href: "/privacy", label: t.footerLinks.privacy },
  { href: "/terms", label: t.footerLinks.terms },
] as const;

/** Bottom of every public page: the brand line and the public pages. */
export function PublicFooter() {
  return (
    <footer className="border-border/60 border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-muted-foreground text-sm sm:flex-row sm:items-center sm:px-6">
        <p className="flex items-center gap-3">
          <LogoMark className="size-8" />
          {t.footer}
        </p>
        <nav aria-label={t.footerNav} className="sm:ml-auto">
          <ul className="flex flex-wrap gap-x-1 gap-y-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  prefetch={false}
                  className="inline-flex min-h-11 items-center rounded-md px-2 font-medium hover:text-foreground"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
