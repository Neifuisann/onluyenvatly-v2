import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { shellCopy } from "@/lib/messages";
import { cn } from "@/lib/utils";

/** Public top bar (07 §2): logo, "Lý thuyết", "Đăng nhập", primary "Đăng ký". */
export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-border/60 border-b bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Logo narrow />
        <nav
          aria-label={shellCopy.mainNav}
          className="ml-auto flex items-center gap-1"
        >
          <Link
            href="/ly-thuyet"
            prefetch={false}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "hidden sm:inline-flex",
            )}
          >
            {shellCopy.theory}
          </Link>
          <Link
            href="/login"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            {shellCopy.login}
          </Link>
          <Link href="/register" className={buttonVariants({ size: "sm" })}>
            {shellCopy.register}
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
