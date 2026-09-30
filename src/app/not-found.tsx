import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { NotFoundContent } from "@/components/not-found-content";
import { notFoundCopy as t } from "@/lib/messages";

export const metadata: Metadata = {
  title: t.title,
  robots: { index: false },
};

/** Any URL that matches no route. */
export default function NotFound() {
  return (
    <main
      id="main"
      className="flex flex-1 flex-col items-center justify-center pt-10"
    >
      <Logo />
      <NotFoundContent />
    </main>
  );
}
