import Link from "next/link";
import { Mascot } from "@/components/mascot";
import { buttonVariants } from "@/components/ui/button";
import { notFoundCopy as t } from "@/lib/messages";

/** The bunny adrift in space, and a way home (root and public 404s). */
export function NotFoundContent() {
  return (
    <div className="flex flex-col items-center gap-6 px-5 py-16 text-center">
      {/* Not `priority`: this tree ships in every page's payload as the 404
          fallback, and an eager image there is preloaded on every page. */}
      <Mascot pose="space" size={200} className="animate-pop" />
      <div className="max-w-md space-y-2">
        <p className="eyebrow text-primary">404</p>
        <h1 className="heading-page">{t.title}</h1>
        <p className="text-muted-foreground">{t.body}</p>
      </div>
      <Link href="/" className={buttonVariants({ size: "lg" })}>
        {t.home}
      </Link>
    </div>
  );
}
