import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { buttonVariants } from "@/components/ui/button";
import { placeholderCopy, shellCopy } from "@/lib/messages";

// Temporary walking-skeleton page; replaced by the landing page in S8-01.
export default function Home() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-16">
        <h1 className="heading-page">{placeholderCopy.homeTitle}</h1>
        <p className="text-muted-foreground">{placeholderCopy.homeBody}</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/register" className={buttonVariants({ size: "lg" })}>
            {shellCopy.register}
          </Link>
          <Link
            href="/login"
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            {shellCopy.login}
          </Link>
        </div>
      </main>
    </>
  );
}
