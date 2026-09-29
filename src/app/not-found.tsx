import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Mascot } from "@/components/mascot";
import { buttonVariants } from "@/components/ui/button";
import { notFoundCopy as t } from "@/lib/messages";

export const metadata: Metadata = {
  title: t.title,
  robots: { index: false },
};

/** Any URL that matches no route: the bunny adrift in space, and a way home. */
export default function NotFound() {
  return (
    <main
      id="main"
      className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-16 text-center"
    >
      <Logo />
      <Mascot pose="space" size={200} priority className="animate-pop" />
      <div className="max-w-md space-y-2">
        <p className="eyebrow text-primary">404</p>
        <h1 className="heading-page">{t.title}</h1>
        <p className="text-muted-foreground">{t.body}</p>
      </div>
      <Link href="/" className={buttonVariants({ size: "lg" })}>
        {t.home}
      </Link>
    </main>
  );
}
